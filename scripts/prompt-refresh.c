#include <stdlib.h>
extern int rl_set_prompt(const char *prompt);

typedef struct word_list WORD_LIST;
typedef int sh_builtin_func_t(WORD_LIST *);

struct builtin {
  char *name;
  sh_builtin_func_t *function;
  int flags;
  char * const *long_doc;
  const char *short_doc;
  char *handle;
};

static int twui_refresh_builtin(WORD_LIST *list) {
  (void)list;
  const char *prompt = getenv("TWUI_READLINE_PROMPT");
  if (!prompt) return 1;
  rl_set_prompt(prompt);
  return 0;
}

static char *twui_refresh_doc[] = {
  "Refresh the current Readline prompt without accepting the line.",
  0
};

struct builtin twui_refresh_struct = {
  "twui_refresh",
  twui_refresh_builtin,
  0x01,
  twui_refresh_doc,
  "twui_refresh",
  0
};
