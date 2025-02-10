#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define MAX_ARGS 10
#define USE_EMBEDDED_COMMANDS 1  // Set to 1 to use embedded commands, 0 to read from file
#define COMMAND_FILE "commands.csv"

// Structure for storing commands
typedef struct {
    char primary[50];
    char secondary[50];
    char command[100];
    char help[200];
} Command;

// Embedded command list (used when USE_EMBEDDED_COMMANDS is set to 1)
Command embedded_commands[] = {
    {"route", "", "", "this is to route stuff"},
    {"route", "add", "route_add.sh", "this is to add a route"},
    {"route", "del", "route_delete.sh -d", "this is to delete a route"},
    {"status", "", "status.sh", "this is to get server status"},
    {"", "", "", ""}  // End marker
};

// Function to read and parse commands from a file
int load_commands(Command *commands, int max_commands) {
    FILE *file = fopen(COMMAND_FILE, "r");
    if (!file) {
        perror("Error opening command file");
        return -1;
    }

    int count = 0;
    char line[256];

    while (fgets(line, sizeof(line), file) && count < max_commands) {
        char *primary = strtok(line, ",");
        char *secondary = strtok(NULL, ",");
        char *command = strtok(NULL, ",");
        char *help = strtok(NULL, "\n");

        if (primary) {
            strncpy(commands[count].primary, primary, sizeof(commands[count].primary) - 1);
            strncpy(commands[count].secondary, secondary ? secondary : "", sizeof(commands[count].secondary) - 1);
            strncpy(commands[count].command, command ? command : "", sizeof(commands[count].command) - 1);
            strncpy(commands[count].help, help ? help : "No description", sizeof(commands[count].help) - 1);
            count++;
        }
    }

    fclose(file);
    return count;
}

// Function to check if a help flag is present
int is_help_flag(char *arg) {
    return (strcmp(arg, "-h") == 0 || strcmp(arg, "--h") == 0 || 
            strcmp(arg, "-help") == 0 || strcmp(arg, "--help") == 0);
}

// Function to show help for a given command
void show_command_help(Command *commands, int count, char *cmd, char *subcmd) {
    for (int i = 0; i < count; i++) {
        if (strcmp(commands[i].primary, cmd) == 0 &&
            ((commands[i].secondary[0] == '\0' && !subcmd) ||
             (subcmd && strcmp(commands[i].secondary, subcmd) == 0))) {
            printf("Usage: darkflows %s %s - %s\n",
                   commands[i].primary,
                   commands[i].secondary[0] ? commands[i].secondary : "",
                   commands[i].help);
            return;
        }
    }
    printf("No help available for '%s %s'\n", cmd, subcmd ? subcmd : "");
}

// Function to execute a command
void execute_command(Command *commands, int count, int argc, char *argv[]) {
    if (argc < 2) {
        printf("Usage: %s <command> [subcommand] [args...]\n", argv[0]);
        return;
    }

    char *cmd = argv[1];
    char *subcmd = (argc > 2) ? argv[2] : NULL;
    char *script = NULL;
    int needs_help = 0;

    // Check for standalone command or multi-word command
    for (int i = 0; i < count; i++) {
        if (strcmp(commands[i].primary, cmd) == 0) {
            if (commands[i].secondary[0] == '\0' && !commands[i].command[0]) {
                // Case: Primary command with no script → Show help
                show_command_help(commands, count, cmd, NULL);
                return;
            } 
            else if (commands[i].secondary[0] == '\0' && commands[i].command[0]) {
                // Case: Primary command with script → Run script
                script = commands[i].command;
                break;
            } 
            else if (subcmd && strcmp(commands[i].secondary, subcmd) == 0) {
                // Case: Multi-word command
                script = commands[i].command;
                break;
            }
        }
    }

    // If script was found, check if a help flag is provided
    if (script) {
        for (int j = subcmd ? 3 : 2; j < argc; j++) {
            if (is_help_flag(argv[j])) {
                needs_help = 1;
                break;
            }
        }

        if (needs_help) {
            show_command_help(commands, count, cmd, subcmd);
            return;
        }

        // Prepare argument list for execvp
        char *exec_args[MAX_ARGS];
        exec_args[0] = strtok(script, " "); // Get script name
        int arg_index = 1;

        char *arg;
        while ((arg = strtok(NULL, " ")) != NULL && arg_index < MAX_ARGS - 1) {
            exec_args[arg_index++] = arg;
        }

        // Append remaining user-provided arguments
        for (int j = subcmd ? 3 : 2; j < argc && arg_index < MAX_ARGS - 1; j++) {
            exec_args[arg_index++] = argv[j];
        }
        exec_args[arg_index] = NULL;

        execvp(exec_args[0], exec_args);
        perror("execvp failed");
        return;
    }

    printf("Unknown command: %s %s\n", cmd, subcmd ? subcmd : "");
}

int main(int argc, char *argv[]) {
    Command commands[50];  // Array to store commands
    int command_count = 0;

    if (USE_EMBEDDED_COMMANDS) {
        // Use embedded commands
        memcpy(commands, embedded_commands, sizeof(embedded_commands));
        command_count = sizeof(embedded_commands) / sizeof(Command) - 1; // Exclude NULL marker
    } else {
        // Load commands from file
        command_count = load_commands(commands, 50);
        if (command_count < 0) {
            return 1;
        }
    }

    execute_command(commands, command_count, argc, argv);
    return 0;
}


