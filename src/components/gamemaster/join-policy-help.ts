import type { Game } from '@/db'

type JoinSetting =
  | 'allowIndividual'
  | 'allowPlayerTeams'
  | 'allowLateJoin'
  | 'allowRejoin'
  | 'requireApproval'
  | 'allowSpectators'
  | 'localNetworkOnly'

/** Help text for the join settings, shared by the new-game wizard and the live panel. */
export const JOIN_POLICY_HELP: Record<JoinSetting & keyof Game, string> = {
  allowIndividual:
    'Players can join without a team and score on their own. Off: everyone must pick or create a team.',
  allowPlayerTeams:
    'Players can type a new team name when they join. Off: they can only pick a team you created.',
  allowLateJoin:
    'New players can join after you start the game. Off: once it starts, new devices are turned away. Rejoining is set separately.',
  allowRejoin:
    'A player who drops or reloads comes back as themselves, keeping their team and score. Off: their device joins as a new player.',
  requireApproval:
    'New players wait in Join requests until you approve them. Players rejoining as themselves get straight back in.',
  allowSpectators:
    "People can follow the game on their phone without playing: the join page offers Just watch, which shows what the screen shows. Anyone with the room code can watch, players included, so keep anything you don't want them to see off the screen. Watchers don't need your approval, can't answer and don't get your messages. Off: anyone watching is disconnected.",
  localNetworkOnly:
    'Only devices on your local network (the same Wi-Fi) can join, play, show the screen or watch. Players still need internet to find the game. Devices already in the game stay when you turn it on.',
}
