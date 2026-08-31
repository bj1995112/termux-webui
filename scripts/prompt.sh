# Termux WebUI prompt loader.
__twui_prompt_config="${TWUI_PROMPT_CONFIG:-$HOME/.config/termux-webui/prompt.conf}"
__twui_prompt_refresh="${TWUI_PROMPT_REFRESH:-$HOME/.config/termux-webui/prompt-refresh.so}"

__twui_prompt_apply() {
  local theme=arrow color=cyan ansi=45
  [ -r "$__twui_prompt_config" ] && . "$__twui_prompt_config"
  case "$color" in
    cyan) ansi=45;; blue) ansi=81;; purple) ansi=141;; pink) ansi=213;;
    green) ansi=48;; yellow) ansi=220;; orange) ansi=208;; red) ansi=203;; white) ansi=255;;
  esac
  local C="\[\e[38;5;${ansi}m\]" R="\[\e[0m\]"
  case "$theme" in
    arrow) PS1="${C}╰─➤ ${R}";;
    powerline) PS1="${C}❯ ${R}";;
    p10k) PS1="${C}\u \w ❯ ${R}";;
    rainbow) PS1="${C}\u \w git ❯ ${R}";;
    tokyo|dracula) PS1="${C}└─➤ ${R}";;
    cyber) PS1="${C}━━━➤ ${R}";;
    hud) PS1="${C}[\u@\h] ━➤ ${R}";;
    double) PS1="${C}╭─ \u@\h \w\n╰─➤ ${R}";;
    minimal) PS1="${C}➜ ${R}";;
    *) PS1="${C}╰─➤ ${R}";;
  esac
}

if [ -n "$TERMUX_WEBUI" ] || [ -r "$__twui_prompt_config" ]; then
  __twui_prompt_apply
  if [ -r "$__twui_prompt_refresh" ]; then
    enable -f "$__twui_prompt_refresh" twui_refresh 2>/dev/null || true
  fi
  bind -m emacs-standard -x '"\e[99~":__twui_prompt_apply; TWUI_READLINE_PROMPT="${PS1@P}" twui_refresh' 2>/dev/null || true
  bind -m vi-insertion -x '"\e[99~":__twui_prompt_apply; TWUI_READLINE_PROMPT="${PS1@P}" twui_refresh' 2>/dev/null || true
fi
