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

// Embedded command list (for USE_EMBEDDED_COMMANDS = 1)
Command embedded_commands[] = {
    {"route", "", "", "this is to route stuff"},
    {"route", "add", "route_add.sh", "this is to add a route"},
    {"route", "del", "route_delete.sh -d", "this is to delete a route"},
    {"status", "", "status.sh", "this is to get server status"},
    {"", "", "", ""}  // End marker (empty strings instead of NULL)
};

// Function to read commands from a file (if not using embedded commands)
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

// Function to check if an argument is a help flag
int is_help_flag(char *arg) {
    return (strcmp(arg, "-h") == 0 || strcmp(arg, "--h") == 0 ||
            strcmp(arg, "-help") == 0 || strcmp(arg, "--help") == 0);
}

// Function to show help for a command (or subcommand)
void show_command_help(Command *commands, int count, char *cmd, char *subcmd) {
    for (int i = 0; i < count; i++) {
        if (strcmp(commands[i].primary, cmd) == 0) {
            if (subcmd) {
                if (strcmp(commands[i].secondary, subcmd) == 0) {
                    printf("Usage: darkflows %s %s - %s\n",
                           commands[i].primary,
                           commands[i].secondary,
                           commands[i].help);
                    return;
                }
            } else {
                if (commands[i].secondary[0] == '\0') {
                    printf("Usage: darkflows %s - %s\n",
                           commands[i].primary,
                           commands[i].help);
                    return;
                }
            }
        }
    }
    printf("No help available for '%s %s'\n", cmd, subcmd ? subcmd : "");
}

// Function to show all commands and their help strings
void show_all_commands(Command *commands, int count) {
    printf("Available commands:\n");
    for (int i = 0; i < count; i++) {
        if (strlen(commands[i].primary) > 0) {
            if (strlen(commands[i].secondary) > 0) {
                printf("  %s %s - %s\n", commands[i].primary, commands[i].secondary, commands[i].help);
            } else {
                printf("  %s - %s\n", commands[i].primary, commands[i].help);
            }
        }
    }
}

// Updated execute_command function with proper help flag handling
void execute_command(Command *commands, int count, int argc, char *argv[]) {
    // If no command is specified, show all commands and exit.
    if (argc < 2) {
        show_all_commands(commands, count);
        return;
    }

    char *cmd = argv[1];
    char *subcmd = NULL;
    int help_flag = 0;

    // Determine if a subcommand is provided or if the only extra argument is a help flag.
    if (argc > 2) {
        if (is_help_flag(argv[2])) {
            // Only help flag provided after the primary command.
            help_flag = 1;
        } else {
            // Treat the second argument as a subcommand.
            subcmd = argv[2];
            // Check for help flag in any additional arguments.
            for (int j = 3; j < argc; j++) {
                if (is_help_flag(argv[j])) {
                    help_flag = 1;
                    break;
                }
            }
        }
    }

    char *script = NULL;

    if (subcmd) {
        // Look for an exact match on primary and subcommand.
        for (int i = 0; i < count; i++) {
            if (strcmp(commands[i].primary, cmd) == 0 && strcmp(commands[i].secondary, subcmd) == 0) {
                script = commands[i].command;
                break;
            }
        }
        // If no matching multi-word command is found or its script is empty, show help.
        if (!script || strlen(script) == 0) {
            show_command_help(commands, count, cmd, subcmd);
            return;
        }
    } else {
        // No subcommand provided; look for the primary command with an empty secondary.
        for (int i = 0; i < count; i++) {
            if (strcmp(commands[i].primary, cmd) == 0 && commands[i].secondary[0] == '\0') {
                script = commands[i].command;
                break;
            }
        }
        // If the primary command's script is empty, show its help.
        if (!script || strlen(script) == 0) {
            show_command_help(commands, count, cmd, NULL);
            return;
        }
    }

    // If a help flag is provided, display the help message.
    if (help_flag) {
        show_command_help(commands, count, cmd, subcmd);
        return;
    }

    // Check if the script exists and is executable.
    if (access(script, X_OK) != 0) {
        perror("Error: Command script not found or not executable");
        return;
    }

    // Prepare argument list for execvp.
    char *exec_args[MAX_ARGS];
    exec_args[0] = script;
    int arg_index = 1;
    int start_index = (subcmd ? 3 : 2);
    for (int j = start_index; j < argc && arg_index < MAX_ARGS - 1; j++) {
        if (!is_help_flag(argv[j])) {
            exec_args[arg_index++] = argv[j];
        }
    }
    exec_args[arg_index] = NULL;

    printf("Executing: %s\n", exec_args[0]);
    execvp(exec_args[0], exec_args);
    perror("execvp failed");
}

int main(int argc, char *argv[]) {
    Command commands[50];  // Array to store commands
    int command_count = 0;

    if (USE_EMBEDDED_COMMANDS) {
        // Use embedded commands.
        memcpy(commands, embedded_commands, sizeof(embedded_commands));
        command_count = sizeof(embedded_commands) / sizeof(Command) - 1; // Exclude end marker.
    } else {
        // Load commands from file.
        command_count = load_commands(commands, 50);
        if (command_count < 0) {
            return 1;
        }
    }

    execute_command(commands, command_count, argc, argv);
    return 0;
}

