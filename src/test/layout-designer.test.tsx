// @vitest-pool vmForks
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { db } from '@/db'
import type { Game, Layout, Widget } from '@/db'
import { setSettings } from '@/lib/app-settings'
import { DEFAULT_LAYOUT_THEME } from '@/lib/layout-grid'
import Layouts from '@/pages/admin/Layouts'

vi.mock('@/components/AdminLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const GAME = { id: 'g1', name: 'Quiz night', createdAt: 1 } as Game

const LAYOUT: Layout = {
  id: 'l1',
  gameId: null,
  name: 'Big screen',
  target: 'screen',
  phase: null,
  theme: { ...DEFAULT_LAYOUT_THEME },
  isActive: true,
  order: 0,
}

const widget = (id: string, patch: Partial<Widget> = {}): Widget => ({
  id,
  layoutId: 'l1',
  type: 'question',
  config: {},
  grid: { x: 0, y: 0, w: 12, h: 1 },
  breakpoints: {},
  order: 0,
  ...patch,
})

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderDesigner(path = '/admin/layouts') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/layouts" element={<Layouts />} />
        <Route path="/admin/layouts/:gameId" element={<Layouts />} />
      </Routes>
      <Where />
    </MemoryRouter>
  )
}

const widgets = () => db.widgets.where('layoutId').equals('l1').toArray()

beforeEach(async () => {
  localStorage.clear()
  await Promise.all([db.layouts.clear(), db.widgets.clear(), db.games.clear()])
  await db.games.put(GAME)
})

describe('layout designer', () => {
  it('says surfaces use their default until a layout exists, then creates one', async () => {
    const user = userEvent.setup()
    renderDesigner()
    expect(await screen.findByText(/built-in default/)).toBeInTheDocument()

    const form = screen.getByRole('form', { name: 'New layout' })
    await user.type(within(form).getByLabelText('Name'), 'Phones')
    await user.selectOptions(within(form).getByLabelText('For'), 'player')
    await user.selectOptions(within(form).getByLabelText('Phase'), 'ended')
    await user.click(within(form).getByRole('button', { name: 'Create layout' }))

    await waitFor(async () => expect(await db.layouts.count()).toBe(1))
    const [created] = await db.layouts.toArray()
    expect(created).toMatchObject({
      name: 'Phones',
      target: 'player',
      phase: 'ended',
      gameId: null,
    })
    // Only widgets allowed on player phones are offered
    expect(await screen.findByRole('button', { name: 'Add Buzzer' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add QR code' })).toBeNull()
  })

  it("creates a game's own layouts on its page, and switches scope", async () => {
    const user = userEvent.setup()
    renderDesigner('/admin/layouts/g1')
    const form = await screen.findByRole('form', { name: 'New layout' })
    await user.click(within(form).getByRole('button', { name: 'Create layout' }))
    await waitFor(async () => expect((await db.layouts.toArray())[0]?.gameId).toBe('g1'))

    await user.selectOptions(screen.getByLabelText('Layouts for'), '')
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/admin\/layouts$/)
  })

  it('adds a widget from the palette below the others and selects it', async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    await db.widgets.put(widget('w1', { grid: { x: 0, y: 0, w: 12, h: 2 } }))
    renderDesigner()

    // Wait for the existing widget, so the new one is placed below it
    await screen.findByRole('button', { name: 'Question widget' })
    await user.click(screen.getByRole('button', { name: 'Add Scoreboard' }))
    await waitFor(async () => expect(await widgets()).toHaveLength(2))
    const added = (await widgets()).find(w => w.type === 'scoreboard')
    expect(added).toMatchObject({ grid: { x: 0, y: 2, w: 6, h: 1 }, order: 1 })
    expect(await screen.findByRole('heading', { name: 'Scoreboard' })).toBeInTheDocument()
  })

  it('edits placement in the inspector, keeping it on the grid', async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    await db.widgets.put(widget('w1', { grid: { x: 0, y: 0, w: 6, h: 1 } }))
    renderDesigner()

    await user.click(await screen.findByRole('button', { name: 'Question widget' }))
    fireEvent.change(screen.getByLabelText('Column'), { target: { value: '12' } })
    // A 6-wide widget can start at column 7 at most
    await waitFor(async () => expect((await widgets())[0].grid.x).toBe(6))
  })

  it("edits a text widget's settings through labelled fields", async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    await db.widgets.put(widget('w1', { type: 'text', config: {} }))
    renderDesigner()

    await user.click(await screen.findByRole('button', { name: 'Text widget' }))
    const text = screen.getByRole('textbox', { name: 'Text' })
    expect(text.tagName).toBe('TEXTAREA')
    await user.type(text, 'Happy hour')
    await user.selectOptions(screen.getByLabelText('Size'), 'large')
    await waitFor(async () =>
      expect((await widgets())[0].config).toMatchObject({ text: 'Happy hour', size: 'large' })
    )
  })

  it('saves an image address on leaving the field, and refuses an unsafe one', async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    await db.widgets.put(widget('w1', { type: 'image', config: {} }))
    renderDesigner()

    await user.click(await screen.findByRole('button', { name: 'Image widget' }))
    const src = screen.getByRole('textbox', { name: /Image address/ })
    await user.type(src, 'javascript:alert(1)')
    await user.tab()
    expect(src).toHaveValue('javascript:alert(1)')
    expect(src).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent(/Not saved/)

    await user.clear(src)
    await user.type(src, 'https://example.com/logo.png')
    await user.tab()
    await waitFor(async () =>
      expect((await widgets())[0].config).toMatchObject({ src: 'https://example.com/logo.png' })
    )
    expect(src).toHaveAttribute('aria-invalid', 'false')
  })

  it('gives a widget its own placement on phones, and resets it', async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    await db.widgets.put(widget('w1', { grid: { x: 0, y: 0, w: 6, h: 1 } }))
    renderDesigner()

    await user.click(await screen.findByRole('button', { name: 'Phone' }))
    await user.click(await screen.findByRole('button', { name: 'Question widget' }))
    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '12' } })
    await waitFor(async () =>
      expect((await widgets())[0].breakpoints.phone).toEqual({ x: 0, y: 0, w: 12, h: 1 })
    )
    expect((await widgets())[0].grid.w).toBe(6)

    await user.click(await screen.findByRole('button', { name: 'Use the base placement' }))
    await waitFor(async () => expect((await widgets())[0].breakpoints).toEqual({}))
  })

  it('moves a widget by dragging it, snapping to cells', async () => {
    await db.layouts.put(LAYOUT)
    await db.widgets.put(widget('w1', { grid: { x: 0, y: 0, w: 4, h: 1 } }))
    renderDesigner()
    const box = await screen.findByRole('button', { name: 'Question widget' })
    const canvas = screen.getByRole('application', { name: 'Layout canvas' })
    // 1200px wide: 100px a column, 48px a row
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ width: 1200 } as DOMRect)

    fireEvent.pointerDown(box, { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(box, { clientX: 260, clientY: 110, pointerId: 1 })
    fireEvent.pointerUp(box, { clientX: 260, clientY: 110, pointerId: 1 })
    await waitFor(async () => expect((await widgets())[0].grid).toEqual({ x: 3, y: 2, w: 4, h: 1 }))
  })

  it('resizes a widget by dragging its corner', async () => {
    await db.layouts.put(LAYOUT)
    await db.widgets.put(widget('w1', { grid: { x: 0, y: 0, w: 4, h: 1 } }))
    renderDesigner()
    const box = await screen.findByRole('button', { name: 'Question widget' })
    const canvas = screen.getByRole('application', { name: 'Layout canvas' })
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ width: 1200 } as DOMRect)
    const handle = box.querySelector('[data-resize-handle]') as HTMLElement

    fireEvent.pointerDown(handle, { button: 0, clientX: 400, clientY: 48, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 600, clientY: 96, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientX: 600, clientY: 96, pointerId: 1 })
    await waitFor(async () => expect((await widgets())[0].grid).toEqual({ x: 0, y: 0, w: 6, h: 2 }))
  })

  it('reorders and removes widgets', async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    await db.widgets.bulkPut([
      widget('w1'),
      widget('w2', { type: 'scoreboard', order: 1, grid: { x: 0, y: 1, w: 6, h: 1 } }),
    ])
    renderDesigner()

    await user.click(await screen.findByRole('button', { name: 'Scoreboard widget' }))
    expect(screen.getByRole('button', { name: 'Later' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Earlier' }))
    await waitFor(async () => {
      const byId = Object.fromEntries((await widgets()).map(w => [w.id, w.order]))
      expect(byId.w2).toBeLessThan(byId.w1)
    })

    await user.click(screen.getByRole('button', { name: 'Remove widget' }))
    await waitFor(async () => expect((await widgets()).map(w => w.id)).toEqual(['w1']))
  })

  it('edits the layout and refuses a logo that is not a safe URL', async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    renderDesigner()

    const settings = await screen.findByRole('region', { name: 'Layout settings' })
    const name = within(settings).getByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'TV')
    await user.tab()
    await user.selectOptions(within(settings).getByLabelText('Phase'), 'reveal')
    await user.click(screen.getByLabelText('Accent'))
    await waitFor(async () =>
      expect(await db.layouts.get('l1')).toMatchObject({
        name: 'TV',
        phase: 'reveal',
        theme: { accent: '#c9a84c' },
      })
    )

    const logo = screen.getByLabelText('Logo URL')
    await user.type(logo, 'javascript:alert(1)')
    await user.tab()
    expect(await screen.findByRole('alert')).toHaveTextContent('https://')
    expect((await db.layouts.get('l1'))?.theme.logo).toBeNull()

    await user.clear(logo)
    await user.type(logo, 'https://example.com/logo.png')
    await user.tab()
    await waitFor(async () =>
      expect((await db.layouts.get('l1'))?.theme.logo).toBe('https://example.com/logo.png')
    )
  })

  it('deletes a layout and its widgets after asking', async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    await db.widgets.put(widget('w1'))
    renderDesigner()

    await user.click(await screen.findByRole('button', { name: 'Delete layout' }))
    expect(await db.layouts.count()).toBe(1)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(async () => expect(await db.layouts.count()).toBe(0))
    expect(await db.widgets.count()).toBe(0)
  })

  it('deletes straight away when confirmations are off', async () => {
    setSettings({ confirmDestructive: false })
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    renderDesigner()
    await user.click(await screen.findByRole('button', { name: 'Delete layout' }))
    await waitFor(async () => expect(await db.layouts.count()).toBe(0))
  })

  it('previews a screen layout with sample data', async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    await db.widgets.bulkPut([
      widget('w1'),
      widget('w2', { type: 'scoreboard', order: 1, grid: { x: 0, y: 1, w: 6, h: 1 } }),
    ])
    renderDesigner()

    await user.click(await screen.findByRole('button', { name: 'Preview' }))
    const preview = await screen.findByRole('region', { name: 'Preview' })
    expect(await within(preview).findByRole('heading', { name: /Red Planet/ })).toBeInTheDocument()
    expect(within(preview).getByText('The Quizzly Bears')).toBeInTheDocument()
  })

  it('previews a leaderboard with its settings', async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    await db.widgets.put(widget('w1', { type: 'leaderboard', config: { places: 2 } }))
    renderDesigner()

    await user.click(await screen.findByRole('button', { name: 'Preview' }))
    const preview = await screen.findByRole('region', { name: 'Preview' })
    const board = await within(preview).findByRole('region', { name: 'Leaderboard' })
    expect(within(board).getAllByRole('listitem')).toHaveLength(2)
    expect(board).toHaveTextContent('The Quizzly Bears')
  })

  it('says the game master surface has no live preview', async () => {
    const user = userEvent.setup()
    await db.layouts.put({ ...LAYOUT, target: 'gamemaster' })
    renderDesigner()
    await user.click(await screen.findByRole('button', { name: 'Preview' }))
    expect(await screen.findByText(/live preview isn.t available/)).toBeInTheDocument()
  })

  it('shows each widget on the canvas as a preview with sample data (#503)', async () => {
    await db.layouts.put(LAYOUT)
    await db.widgets.bulkPut([
      widget('w1', { grid: { x: 0, y: 0, w: 12, h: 3 } }),
      widget('w2', { type: 'scoreboard', order: 1, grid: { x: 0, y: 3, w: 6, h: 2 } }),
    ])
    renderDesigner()

    const box = await screen.findByRole('button', { name: 'Question widget' })
    await waitFor(() =>
      expect(box.querySelector('[data-widget-preview="question"]')).not.toBeNull()
    )
    expect(box).toHaveTextContent(/Red Planet/)
    const scores = screen.getByRole('button', { name: 'Scoreboard widget' })
    expect(scores).toHaveTextContent('The Quizzly Bears')
    // A picture only: nothing in it is reachable, and the box keeps its name
    const preview = box.querySelector('[data-widget-preview]') as HTMLElement
    expect(preview).toHaveAttribute('aria-hidden', 'true')
    expect(preview).toHaveAttribute('inert')
  })

  it('keeps plain labelled boxes on the game master canvas', async () => {
    await db.layouts.put({ ...LAYOUT, target: 'gamemaster' })
    await db.widgets.put(widget('w1'))
    renderDesigner()
    const box = await screen.findByRole('button', { name: 'Question widget' })
    expect(box.querySelector('[data-widget-preview]')).toBeNull()
    expect(box).toHaveTextContent('Question')
  })

  it('previews a palette widget on hover and focus', async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    renderDesigner()
    const item = await screen.findByRole('button', { name: 'Add Leaderboard' })
    const li = item.closest('li') as HTMLElement

    await user.hover(item)
    await waitFor(() =>
      expect(li.querySelector('[data-widget-preview="leaderboard"]')).not.toBeNull()
    )
    expect(li).toHaveTextContent('The Quizzly Bears')
    await user.unhover(item)
    expect(li.querySelector('[data-widget-preview]')).toBeNull()

    act(() => item.focus())
    expect(li.querySelector('[data-widget-preview="leaderboard"]')).not.toBeNull()
  })

  it('adds a palette widget where it is dropped', async () => {
    await db.layouts.put(LAYOUT)
    renderDesigner()
    const canvas = await screen.findByRole('application', { name: 'Layout canvas' })
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      width: 1200,
      left: 0,
      top: 0,
    } as DOMRect)
    const dataTransfer = {
      types: ['application/x-viktorani-widget'],
      getData: () => 'timer',
    }
    // jsdom's drag events carry no coordinates, so set them on the event itself
    const drop = createEvent.drop(canvas, { dataTransfer })
    Object.defineProperties(drop, { clientX: { value: 650 }, clientY: { value: 100 } })
    await act(async () => {
      fireEvent(canvas, drop)
    })
    await waitFor(async () =>
      expect((await widgets())[0]).toMatchObject({
        type: 'timer',
        grid: { x: 6, y: 2, w: 6, h: 1 },
      })
    )
  })
})

describe('layout designer: undo, keyboard and copies (#413)', () => {
  it('undoes and redoes a change, from the buttons and the keyboard', async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    renderDesigner()

    const undo = await screen.findByRole('button', { name: 'Undo' })
    expect(undo).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Add Timer' }))
    await waitFor(async () => expect(await widgets()).toHaveLength(1))

    await waitFor(() => expect(undo).toBeEnabled())
    await user.click(undo)
    await waitFor(async () => expect(await widgets()).toHaveLength(0))

    await user.click(screen.getByRole('button', { name: 'Redo' }))
    await waitFor(async () => expect(await widgets()).toHaveLength(1))

    // Ctrl+Z from anywhere in the designer except a text field
    await user.click(screen.getByRole('button', { name: 'Timer widget' }))
    await user.keyboard('{Control>}z{/Control}')
    await waitFor(async () => expect(await widgets()).toHaveLength(0))
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    await waitFor(async () => expect(await widgets()).toHaveLength(1))
  })

  it('undoes a layout rename and shows the old name again', async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    renderDesigner()

    const settings = await screen.findByRole('region', { name: 'Layout settings' })
    const name = within(settings).getByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Renamed')
    await user.tab()
    await waitFor(async () => expect((await db.layouts.get('l1'))?.name).toBe('Renamed'))

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect((await db.layouts.get('l1'))?.name).toBe('Big screen'))
    await waitFor(() => expect(name).toHaveValue('Big screen'))
  })

  it('moves, resizes, duplicates and removes a widget from the keyboard', async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    await db.widgets.put(widget('w1', { grid: { x: 0, y: 0, w: 6, h: 1 } }))
    renderDesigner()

    const box = await screen.findByRole('button', { name: 'Question widget' })
    box.focus()
    await user.keyboard('{ArrowRight}')
    await waitFor(async () => expect((await widgets())[0].grid).toMatchObject({ x: 1, y: 0 }))
    expect(screen.getByRole('status')).toHaveTextContent('column 2, row 1, 6 wide, 1 high')

    await user.keyboard('{Shift>}{ArrowDown}{/Shift}')
    await waitFor(async () => expect((await widgets())[0].grid).toMatchObject({ h: 2 }))

    // Moving past the edge leaves it where it is
    await user.keyboard('{ArrowUp}')
    await waitFor(async () => expect((await widgets())[0].grid.y).toBe(0))

    await user.keyboard('{Control>}d{/Control}')
    await waitFor(async () => expect(await widgets()).toHaveLength(2))
    const copy = (await widgets()).find(w => w.id !== 'w1')
    expect(copy).toMatchObject({ type: 'question', grid: { x: 1, y: 2, w: 6, h: 2 }, order: 1 })

    screen.getAllByRole('button', { name: 'Question widget' })[0].focus()
    await user.keyboard('{Delete}')
    await waitFor(async () => expect(await widgets()).toHaveLength(1))
  })

  it('duplicates the selected widget from the inspector', async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    await db.widgets.put(widget('w1', { breakpoints: { phone: { x: 0, y: 3, w: 12, h: 1 } } }))
    renderDesigner()

    await user.click(await screen.findByRole('button', { name: 'Question widget' }))
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))
    await waitFor(async () => expect(await widgets()).toHaveLength(2))
    const copy = (await widgets()).find(w => w.id !== 'w1')
    expect(copy?.breakpoints).toEqual({ phone: { x: 0, y: 3, w: 12, h: 1 } })
    // The copy is selected
    expect(
      screen
        .getAllByRole('button', { name: 'Question widget' })
        .filter(b => b.getAttribute('aria-pressed') === 'true')
    ).toHaveLength(1)
  })

  it('starts a new layout from a built-in default', async () => {
    const user = userEvent.setup()
    renderDesigner()

    const form = await screen.findByRole('form', { name: 'New layout' })
    await user.selectOptions(within(form).getByLabelText('For'), 'player')
    await user.selectOptions(within(form).getByLabelText('Start from'), 'builtin:player:all')
    await user.click(within(form).getByRole('button', { name: 'Create layout' }))

    await waitFor(async () => expect(await db.layouts.count()).toBe(1))
    const [created] = await db.layouts.toArray()
    expect(created).toMatchObject({ target: 'player', gameId: null, phase: null })
    expect(created.id.startsWith('builtin:')).toBe(false)
    const copied = await db.widgets.where('layoutId').equals(created.id).sortBy('order')
    expect(copied.map(w => w.type)).toEqual(['announcement', 'question', 'buzzer', 'timer'])
  })

  it("starts a game's layout from a template", async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    await db.widgets.put(widget('w1'))
    renderDesigner('/admin/layouts/g1')

    const form = await screen.findByRole('form', { name: 'New layout' })
    await within(form).findByRole('option', { name: 'Template: Big screen' })
    await user.selectOptions(within(form).getByLabelText('Start from'), 'Template: Big screen')
    await user.click(within(form).getByRole('button', { name: 'Create layout' }))

    await waitFor(async () => expect(await db.layouts.where('gameId').equals('g1').count()).toBe(1))
    const created = await db.layouts.where('gameId').equals('g1').first()
    expect(await db.widgets.where('layoutId').equals(created!.id).count()).toBe(1)
  })

  it('duplicates a layout and copies a template into a game', async () => {
    const user = userEvent.setup()
    await db.layouts.put(LAYOUT)
    await db.widgets.put(widget('w1'))
    renderDesigner()

    await user.click(await screen.findByRole('button', { name: 'Duplicate layout' }))
    await waitFor(async () => expect(await db.layouts.count()).toBe(2))
    expect(await screen.findByRole('button', { name: /Big screen \(copy\)/, current: true }))

    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await screen.findByText('Copied to Quiz night.')).toBeInTheDocument()
    const inGame = await db.layouts.where('gameId').equals('g1').toArray()
    expect(inGame).toHaveLength(1)
    expect(await db.widgets.where('layoutId').equals(inGame[0].id).count()).toBe(1)
  })

  it("saves a game's layout as a template", async () => {
    const user = userEvent.setup()
    await db.layouts.put({ ...LAYOUT, gameId: 'g1' })
    renderDesigner('/admin/layouts/g1')

    await user.click(await screen.findByRole('button', { name: 'Save as template' }))
    expect(await screen.findByText('Saved as a template.')).toBeInTheDocument()
    const templates = await db.layouts.filter(l => l.gameId === null).toArray()
    expect(templates).toMatchObject([{ name: 'Big screen', target: 'screen' }])
  })
})
