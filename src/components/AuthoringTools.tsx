import { useLocation } from 'react-router-dom'
import { AiToolsStatus } from '@/components/gamemaster/AiToolsStatus'
import { useAuthoringTools } from '@/hooks/useAiTools'

/**
 * Offers the authoring tools to an assistant on the admin pages (#532), with the badge and
 * confirmation dialog that go with them. The game master and its screens are left out: the
 * game master has its own live tools and dialog.
 */
export function AuthoringTools() {
  const { pathname } = useLocation()
  const open = pathname.startsWith('/admin') && !pathname.startsWith('/admin/game/')
  const active = useAuthoringTools(open)
  return open ? <AiToolsStatus active={active} /> : null
}
