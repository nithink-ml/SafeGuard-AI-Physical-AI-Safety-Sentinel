#!/bin/bash

# =========================================================
# ESP-IDF + FirmGen host prerequisites installer (macOS) - v2
#
# Successor to scripts/install_dependencies.sh: the same twelve steps, without the side
# effects that broke a Mac which already had other tools or ESP-IDF versions set up.
#
# WHAT CHANGED FROM install_dependencies.sh
#   1. IDF_PYTHON_ENV_PATH is no longer exported to every shell (~/.zshrc) and every GUI
#      app (LaunchAgent). ESP-IDF records in each venv the IDF version that built it and
#      refuses a mismatch, so the global value stopped every OTHER ESP-IDF version on the
#      Mac from activating. FirmGen does not need it: main.js and the engine find the venv
#      themselves. The LaunchAgent an earlier run left behind is removed, and the session
#      variable it set is unset. FIRMGEN_KEEP_LAUNCHAGENT=1 keeps the old behaviour.
#   2. The terminal helper is `firmgen_idf`; `get_idf` is added only when nothing by that
#      name exists. Espressif's macOS guide has users add `alias get_idf=...`, and under
#      that alias the old `get_idf() {` line was a zsh parse error in every new terminal.
#   3. ccache is installed. The engine turns it on for every build (IDF_CCACHE_ENABLE=1),
#      and ESP-IDF never installs it on macOS.
#   4. Nothing that already exists is replaced: /usr/local/bin links are only created where
#      no file or link is, /etc/paths.d/homebrew is appended to, and the first
#      *.bak_idf_install backup is kept on re-runs.
#   5. ~/.zshrc is backed up once and left alone if the block's markers don't pair up
#      (removing an unterminated block deleted everything below its start marker).
#   6. A warning, not a stop, on a Mac FirmGen can't run on (Intel, or macOS before 26).
#
# WHY PYTHON IS PINNED (unchanged)
#   ESP-IDF picks the FIRST `python3` on PATH (tools/detect_python.sh) and names its
#   virtualenv after that interpreter's version, e.g.
#   ~/.espressif/python_env/idf5.5_py<MAJOR.MINOR>_env. IDF_PYTHON_ENV_PATH is the one
#   override it honors. So this installer:
#     1. installs a pinned Homebrew python@3.11 at a known path,
#     2. puts that python first on PATH while it (re)builds ESP-IDF, and inside the
#        firmgen_idf helper, so `python3` is 3.11 for export.sh/install.sh,
#     3. sets IDF_PYTHON_ENV_PATH for its own run and inside the helper only.
#   It also sweeps away stale venvs for THIS IDF version (e.g. a leftover
#   idf5.5_py3.14_env): with two of them, FirmGen's own venv lookup can pick the wrong
#   one. Other IDF versions' venvs are left alone.
#
# Step 11 seeds the app's own settings.json. The desktop app regenerates every
# esp32_tools.yaml from it on each launch; with no ESP-IDF path set it scans ~/Espressif,
# ~/esp and /opt/esp itself, but seeding pins THIS install.
#
# Step 1 detects your Mac chip and sets all paths/flags.
# Every subsequent step skips work that is already done (idempotent).
#
# Env overrides:
#   FIRMGEN_SKIP_ROSETTA=1      skip the Rosetta 2 install (step 7; only STM32 needs it)
#   FIRMGEN_KEEP_LAUNCHAGENT=1  export IDF_PYTHON_ENV_PATH to GUI apps through a LaunchAgent,
#                               as install_dependencies.sh did. Only for a FirmGen .dmg built
#                               before 2026-09-29 (commit ef1085f7), which needs it for ESP32
#                               builds. Other ESP-IDF versions then refuse to activate in apps
#                               opened from the Dock again; Terminal stays fixed.
#
# Not installed here: the STM32 toolchain (STM32CubeCLT and an STM32Cube FW package, from
# st.com) and the C2000 one (Code Composer Studio and C2000Ware, from ti.com).
#
# No USB-serial driver step: macOS 26 (FirmGen's floor) ships DriverKit drivers for CP210x,
# CH34x and FTDI bridges (AppleUSBSLCOM / AppleUSBCHCOM / AppleUSBFTDI).
# =========================================================

set -e

# -------------------------
# CONFIG
# -------------------------
ESP_IDF_VERSION="v5.5"
ESP_IDF_SHORT="5.5"                       # used to build the venv dir name
ESP_ROOT="$HOME/Espressif"
ESP_IDF_DIR="$ESP_ROOT/esp-idf-release-v5.5"
PROJECTS_DIR="$ESP_ROOT/projects"
PYTHON_VERSION="3.11"
ESPRESSIF_DIR="$HOME/.espressif"
PYENV_DIR="$ESPRESSIF_DIR/python_env"
# The exact venv ESP-IDF must use. We pin this everywhere instead of letting
# ESP-IDF derive it from whatever python3 happens to be first on PATH.
CANONICAL_VENV="$PYENV_DIR/idf${ESP_IDF_SHORT}_py${PYTHON_VERSION}_env"

# FirmGen's .dmg is arm64 only with LSMinimumSystemVersion 26.0
# (craftifai-desktop/electron-builder.yml).
FIRMGEN_MIN_MACOS=26

# The LaunchAgent install_dependencies.sh wrote; removed in step 9 unless
# FIRMGEN_KEEP_LAUNCHAGENT=1. Same label and path, so scripts/Existing_Release_Removal.sh
# still finds it.
LAUNCH_AGENT_LABEL="com.craftifai.espidf-env"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/$LAUNCH_AGENT_LABEL.plist"

# ~/.zshrc block markers. Unchanged, so a re-run replaces the block an older run wrote and
# Existing_Release_Removal.sh still detects it.
ZSH_MARKER="# >>> ESP-IDF installer managed block <<<"
ZSH_END_MARKER="# >>> end ESP-IDF installer managed block <<<"

# CraftifAI / Refact GUI runtime config locations (auto-read by the app).
FIRMGEN_CONFIG_PATHS=(
    "$HOME/.config/craftifai/esp32_tools.yaml"
    "$HOME/.config/refact/esp32_tools.yaml"
    "$HOME/.cache/refact/esp32_tools.yaml"
)
SERIAL_PORT=""     # set by detect_serial_port()

# Set by detect_chip()
CHIP_MODEL=""
CHIP_TYPE=""       # "apple_silicon" | "intel"
CHIP_ARCH=""       # "arm64" | "x86_64"
BREW_PREFIX=""     # "/opt/homebrew" (Apple Silicon) | "/usr/local" (Intel)
ARCH_CMD=""        # "arch -arm64" (Apple Silicon) | "" (Intel)
MACOS_VERSION=""
UNSUPPORTED_REASON=""  # why FirmGen can't run on this Mac; empty when it can

# Set by ensure_python()
PINNED_PYTHON=""       # absolute path to the pinned python3.11 binary
PINNED_PY_LIBEXEC=""   # dir holding an unversioned `python3` that IS 3.11

# Set by steps 9 and 10, read by the summary
GUI_ENV_STATUS=""      # what happened to IDF_PYTHON_ENV_PATH for GUI apps
SHELL_BLOCK_STATUS=""  # "written" | "skipped"
SHELL_HELPER=""        # the command to type in a terminal
OWN_GET_IDF_FILE=""    # the startup file that defines the user's own get_idf, if any

# -------------------------
# HELPERS
# -------------------------
skip()    { echo "  [SKIP]    $*"; }
install() { echo "  [INSTALL] $*"; }
ok()      { echo "  [OK]      $*"; }
warn()    { echo "  [WARN]    $*"; }
fix()     { echo "  [FIX]     $*"; }
err()     { echo "  [ERROR]   $*"; }

# Copy FILE to FILE.bak_idf_install unless that backup already exists. Keeping the first
# one means a re-run can't replace the user's original with this installer's own output.
backup_once() {
    local f="$1" bak="$1.bak_idf_install"
    [[ -f "$f" ]] || return 0
    if [[ -e "$bak" ]]; then
        skip "backup from an earlier run kept: $bak"
    elif cp "$f" "$bak" 2>/dev/null; then
        ok "backup: $bak"
    else
        warn "could not back up $f"
    fi
}

# =========================================================
# 1. CHIP + macOS CHECK
# =========================================================
detect_chip() {
    echo
    echo "=== [1/12] Chip + macOS Check ==="

    CHIP_MODEL=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Unknown")
    RUNTIME_ARCH=$(uname -m)
    MACOS_VERSION=$(sw_vers -productVersion 2>/dev/null || echo "unknown")

    echo
    echo "  Chip model : $CHIP_MODEL"
    echo "  Runtime    : $RUNTIME_ARCH"
    echo "  macOS      : $MACOS_VERSION"
    echo

    if [[ "$CHIP_MODEL" == Apple\ M* ]]; then
        CHIP_TYPE="apple_silicon"
        CHIP_ARCH="arm64"
        BREW_PREFIX="/opt/homebrew"
        ARCH_CMD="arch -arm64"

        CHIP_GEN=$(echo "$CHIP_MODEL" | grep -oE 'M[0-9]+' | head -1)
        ok "Apple Silicon $CHIP_GEN detected"
        ok "All tools will be installed as arm64 native"

        # Rosetta guard
        if [[ "$RUNTIME_ARCH" == "x86_64" ]]; then
            echo
            err "This terminal is running under Rosetta (x86_64) on an $CHIP_GEN chip."
            echo
            echo "  That would build x86_64 tools and break ESP-IDF on Apple Silicon."
            echo
            echo "  Fix:"
            echo "    1. Quit Terminal"
            echo "    2. Right-click Terminal.app in Finder -> Get Info"
            echo "    3. Uncheck 'Open using Rosetta'"
            echo "    4. Reopen Terminal and run this script again."
            echo
            exit 1
        fi

    elif [[ "$CHIP_MODEL" == Intel* ]]; then
        CHIP_TYPE="intel"
        CHIP_ARCH="x86_64"
        BREW_PREFIX="/usr/local"
        ARCH_CMD=""
        ok "Intel Mac detected -> tools will be installed as x86_64"

    else
        CHIP_TYPE="unknown"
        CHIP_ARCH="$RUNTIME_ARCH"
        BREW_PREFIX="/usr/local"
        ARCH_CMD=""
        warn "Unrecognised chip: $CHIP_MODEL - proceeding with defaults."
    fi

    # The .dmg will not install on any other Mac. ESP-IDF itself still works from Terminal
    # there, so this warns instead of stopping.
    local macos_major="${MACOS_VERSION%%.*}"
    if [[ "$CHIP_ARCH" != "arm64" ]]; then
        UNSUPPORTED_REASON="FirmGen runs only on Apple Silicon Macs"
    elif [[ "$macos_major" =~ ^[0-9]+$ ]] && (( macos_major < FIRMGEN_MIN_MACOS )); then
        UNSUPPORTED_REASON="FirmGen needs macOS $FIRMGEN_MIN_MACOS or later (this Mac has $MACOS_VERSION)"
    fi
    if [[ -n "$UNSUPPORTED_REASON" ]]; then
        echo
        warn "$UNSUPPORTED_REASON - the FirmGen app will not install here."
        warn "Continuing anyway: ESP-IDF will still work from Terminal."
    fi

    echo
    printf  "  Chip  : %s\n" "$CHIP_MODEL"
    printf  "  Type  : %s\n" "$CHIP_TYPE"
    printf  "  Arch  : %s\n" "$CHIP_ARCH"
    printf  "  Brew  : %s\n" "$BREW_PREFIX"
}

# =========================================================
# 2. HOMEBREW
# =========================================================
ensure_homebrew() {
    echo
    echo "=== [2/12] Homebrew ==="

    BREW_BIN="$BREW_PREFIX/bin/brew"

    if [[ -x "$BREW_BIN" ]]; then
        eval "$("$BREW_BIN" shellenv)"
        skip "Homebrew already installed -> $(brew --version | head -1)"
        return
    fi

    if [[ "$CHIP_TYPE" == "apple_silicon" ]] && [[ -x /usr/local/bin/brew ]]; then
        warn "/usr/local/bin/brew found (x86_64 Rosetta Homebrew)."
        warn "Installing the arm64 Homebrew at /opt/homebrew instead..."
    fi

    install "Homebrew at $BREW_PREFIX ..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$("$BREW_BIN" shellenv)"
    ok "Homebrew installed -> $(brew --version | head -1)"
}

# =========================================================
# 3. PYTHON  (pinned, deterministic)
#    We deliberately ignore the ambient `python3`. We install our own
#    Homebrew python@3.11 and remember its exact paths. Everything ESP-IDF
#    related will be forced to use THIS interpreter.
# =========================================================
ensure_python() {
    echo
    echo "=== [3/12] Python ${PYTHON_VERSION} (pinned via Homebrew) ==="

    if brew list --formula "python@${PYTHON_VERSION}" >/dev/null 2>&1; then
        skip "Homebrew python@${PYTHON_VERSION} already installed"
    else
        install "Homebrew python@${PYTHON_VERSION}..."
        brew install "python@${PYTHON_VERSION}"
    fi

    # Versioned binary (always present after install)
    PINNED_PYTHON="$BREW_PREFIX/bin/python${PYTHON_VERSION}"

    # Dir with UNVERSIONED `python`/`python3` symlinks pointing at 3.11.
    # Prepending this to PATH makes a bare `python3` resolve to 3.11, which is
    # what tools/detect_python.sh actually keys off of.
    local py_prefix
    py_prefix="$(brew --prefix "python@${PYTHON_VERSION}" 2>/dev/null || echo "$BREW_PREFIX/opt/python@${PYTHON_VERSION}")"
    PINNED_PY_LIBEXEC="$py_prefix/libexec/bin"

    if [[ ! -x "$PINNED_PYTHON" ]]; then
        # fall back to the unversioned symlink if the versioned one is absent
        if [[ -x "$PINNED_PY_LIBEXEC/python3" ]]; then
            PINNED_PYTHON="$PINNED_PY_LIBEXEC/python3"
        else
            err "Could not locate Homebrew python${PYTHON_VERSION}."
            err "Looked at: $BREW_PREFIX/bin/python${PYTHON_VERSION} and $PINNED_PY_LIBEXEC/python3"
            exit 1
        fi
    fi

    local pv pa
    pv="$("$PINNED_PYTHON" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
    pa="$("$PINNED_PYTHON" -c 'import platform;print(platform.machine())')"

    if [[ "$pv" != "$PYTHON_VERSION" ]]; then
        err "Pinned python reports $pv, expected $PYTHON_VERSION."
        exit 1
    fi
    if [[ "$CHIP_TYPE" == "apple_silicon" && "$pa" != "arm64" ]]; then
        err "Pinned python is $pa but Apple Silicon needs arm64 (Rosetta still on?)."
        exit 1
    fi

    ok "Pinned Python   : $PINNED_PYTHON  ($pv, $pa)"
    ok "Unversioned bin : $PINNED_PY_LIBEXEC  (prepended to PATH for ESP-IDF only)"
}

# =========================================================
# 4. GIT
# =========================================================
ensure_git() {
    echo
    echo "=== [4/12] Git ==="

    if command -v git >/dev/null 2>&1; then
        skip "Git already installed -> $(git --version)"
        return
    fi
    install "Git..."
    brew install git
    ok "Git -> $(git --version)"
}

# =========================================================
# 5. BUILD TOOLS (cmake, ninja, dfu-util, ccache)
#    Ensure they exist at $BREW_PREFIX/bin and (Apple Silicon) that cmake is arm64.
#    ccache: the engine sets IDF_CCACHE_ENABLE=1 on every idf.py build, but ESP-IDF's
#    tools.json marks ccache install=never on macOS - without this, every build warns
#    "enabled ccache in build but ccache program not found" and runs uncached.
# =========================================================
ensure_build_tools() {
    echo
    echo "=== [5/12] Build Tools (cmake, ninja, dfu-util, ccache) ==="

    for tool in cmake ninja dfu-util ccache; do
        if [[ -x "$BREW_PREFIX/bin/$tool" ]]; then
            if [[ "$tool" == "cmake" && "$CHIP_TYPE" == "apple_silicon" ]]; then
                local a
                a=$(file "$BREW_PREFIX/bin/cmake" | grep -o 'arm64\|x86_64' | head -1)
                if [[ "$a" != "arm64" ]]; then
                    fix "cmake at $BREW_PREFIX is $a on Apple Silicon - reinstalling arm64..."
                    brew reinstall cmake
                fi
            fi
            skip "$tool present -> $BREW_PREFIX/bin/$tool"
        else
            install "$tool..."
            brew install "$tool"
            ok "$tool installed"
        fi
    done
}

# =========================================================
# 6. DOCUMENTATION TOOLCHAIN (doxygen + graphviz)
#    FirmGen's "generate project documentation" step shells out to `doxygen`.
#    Graphviz (`dot`) is optional but adds the call/include/collaboration
#    diagrams — without it the report still builds, just without graphs.
# =========================================================
ensure_doc_tools() {
    echo
    echo "=== [6/12] Documentation Tools (doxygen, graphviz) ==="

    for tool in doxygen graphviz; do
        # The graphviz formula installs the `dot` binary, not `graphviz`.
        local bin="$tool"
        [[ "$tool" == "graphviz" ]] && bin="dot"

        if [[ -x "$BREW_PREFIX/bin/$bin" ]]; then
            skip "$tool present -> $BREW_PREFIX/bin/$bin ($("$BREW_PREFIX/bin/$bin" --version 2>&1 | head -1))"
        else
            install "$tool..."
            brew install "$tool"
            ok "$tool installed"
        fi
    done

    if [[ -x "$BREW_PREFIX/bin/doxygen" ]]; then
        ok "Doxygen -> $("$BREW_PREFIX/bin/doxygen" --version 2>&1 | head -1)"
    else
        warn "doxygen not found after install - documentation generation will report 'Doxygen is not installed'."
    fi
}

# =========================================================
# 7. ROSETTA 2 (Apple Silicon)
#    STM32CubeCLT's macOS tools (arm-none-eabi-gcc/gdb, ST-LINK_gdbserver,
#    STM32_Programmer_CLI) are Intel-only; without Rosetta every STM32
#    build/flash/debug fails with "Bad CPU type in executable".
# =========================================================
rosetta_installed() { /usr/bin/arch -x86_64 /usr/bin/true >/dev/null 2>&1; }

ensure_rosetta() {
    echo
    echo "=== [7/12] Rosetta 2 (for STM32CubeCLT's Intel-only tools) ==="

    if [[ "$CHIP_TYPE" != "apple_silicon" ]]; then
        skip "Rosetta 2 only matters on Apple Silicon"
        return
    fi
    if [[ "${FIRMGEN_SKIP_ROSETTA:-0}" == "1" ]]; then
        skip "Rosetta 2 (FIRMGEN_SKIP_ROSETTA=1)"
        return
    fi
    if rosetta_installed; then
        skip "Rosetta 2 already installed"
        return
    fi

    install "Rosetta 2 (softwareupdate)..."
    # Unprivileged first (works for many admin accounts), then via sudo (admins get a
    # password prompt; standard users' sudo fails). Never fatal: only STM32 needs Rosetta
    # and ESP-IDF below must still install.
    /usr/sbin/softwareupdate --install-rosetta --agree-to-license \
        || sudo /usr/sbin/softwareupdate --install-rosetta --agree-to-license \
        || true
    if rosetta_installed; then
        ok "Rosetta 2 installed"
    else
        warn "Rosetta 2 is not installed - STM32 build/flash/debug will fail with 'Bad CPU type'."
        warn "An administrator can run:  softwareupdate --install-rosetta --agree-to-license"
    fi
}

# =========================================================
# 8. ESP-IDF  (deterministic Python)
# =========================================================
install_esp_idf() {
    echo
    echo "=== [8/12] ESP-IDF $ESP_IDF_VERSION ==="

    mkdir -p "$ESP_ROOT" "$PROJECTS_DIR" "$PYENV_DIR"

    # ── clone if missing ──────────────────────────────────
    if [[ ! -d "$ESP_IDF_DIR" ]]; then
        install "Cloning ESP-IDF $ESP_IDF_VERSION..."
        git clone -b "$ESP_IDF_VERSION" --recursive \
            https://github.com/espressif/esp-idf.git "$ESP_IDF_DIR"
    else
        skip "ESP-IDF repo present -> $ESP_IDF_DIR"
    fi

    cd "$ESP_IDF_DIR"

    # ── force ESP-IDF onto the pinned 3.11 ────────────────
    # (a) Make `python3` resolve to 3.11 for detect_python.sh.
    export PATH="$PINNED_PY_LIBEXEC:$PATH"
    # (b) Pin the venv path - the only override ESP-IDF honors. This run only: nothing
    #     here persists it for other shells or apps.
    export IDF_PYTHON_ENV_PATH="$CANONICAL_VENV"

    ok "python3 for ESP-IDF -> $(python3 --version 2>&1)  [$(command -v python3)]"
    ok "IDF_PYTHON_ENV_PATH -> $IDF_PYTHON_ENV_PATH"

    # ── sweep stale venvs for THIS IDF version (e.g. leftover idf5.5_py3.14_env) ─
    #
    # Scoped to `idf<THIS VERSION>_py*_env` on purpose. Deleting every directory that is
    # not the canonical one also removed the venvs of OTHER ESP-IDF installs — a user
    # with 5.1 and 5.3 alongside 5.5 lost both, and their next `get_idf` in those trees
    # failed with the very "venv not found" error this script exists to prevent.
    if [[ -d "$PYENV_DIR" ]]; then
        for d in "$PYENV_DIR"/idf${ESP_IDF_SHORT}_py*_env; do
            [[ -d "$d" ]] || continue
            d="${d%/}"
            if [[ "$d" != "$CANONICAL_VENV" ]]; then
                fix "Removing stale venv for IDF $ESP_IDF_SHORT: $(basename "$d")"
                rm -rf "$d"
            fi
        done
    fi

    # ── (re)install only if the canonical venv is missing/wrong ─
    local need_install=true
    if [[ -x "$CANONICAL_VENV/bin/python" ]]; then
        local vv va
        vv="$("$CANONICAL_VENV/bin/python" -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "?")"
        va="$("$CANONICAL_VENV/bin/python" -c 'import platform;print(platform.machine())' 2>/dev/null || echo "?")"
        if [[ "$vv" == "$PYTHON_VERSION" && "$va" == "$CHIP_ARCH" ]]; then
            set +e
            ( source "$ESP_IDF_DIR/export.sh" >/dev/null 2>&1 && idf.py --version >/dev/null 2>&1 )
            local rc=$?
            set -e
            if [[ $rc -eq 0 ]]; then
                need_install=false
                skip "Canonical venv OK -> $CANONICAL_VENV  ($vv, $va)"
            else
                fix "Canonical venv exists but won't activate - reinstalling..."
            fi
        else
            fix "Canonical venv is $vv/$va (need $PYTHON_VERSION/$CHIP_ARCH) - reinstalling..."
            rm -rf "$CANONICAL_VENV"
        fi
    fi

    if $need_install; then
        install "Running ESP-IDF install.sh ($CHIP_ARCH, Python $PYTHON_VERSION)..."
        chmod +x install.sh
        $ARCH_CMD ./install.sh
    fi

    # ── cmake + ninja from ESP-IDF itself ─────────────────
    # tools.json marks both install=on_request on macOS, so install.sh never fetches them and
    # idf.py relies on whatever is on PATH - a Finder-launched FirmGen has launchd's PATH
    # ("cmake must be available on the PATH"). Installed here, export.sh adds them to PATH
    # itself (CMake.app/Contents/bin, ninja). Idempotent: installed versions are skipped.
    install "ESP-IDF cmake + ninja (idf_tools.py install cmake ninja)..."
    if [[ ! -x "$CANONICAL_VENV/bin/python" ]]; then
        err "ESP-IDF venv missing at $CANONICAL_VENV"
        exit 1
    fi
    if ! IDF_PATH="$ESP_IDF_DIR" $ARCH_CMD "$CANONICAL_VENV/bin/python" \
            "$ESP_IDF_DIR/tools/idf_tools.py" install cmake ninja; then
        err "idf_tools.py could not install cmake/ninja (network?). Re-run this script."
        exit 1
    fi

    # ── activate + verify ─────────────────────────────────
    set +e
    source "$ESP_IDF_DIR/export.sh"
    local exp_rc=$?
    set -e
    if [[ $exp_rc -ne 0 ]]; then
        err "export.sh failed even after install - see output above."
        exit 1
    fi

    ok "ESP-IDF -> $(idf.py --version 2>/dev/null || echo 'idf.py NOT found')"
    local cm nj
    cm="$(command -v cmake || true)"
    nj="$(command -v ninja || true)"
    case "$cm" in
        "$ESPRESSIF_DIR"/tools/cmake/*) ok "cmake -> $cm (ESP-IDF)" ;;
        *) warn "cmake resolves to '${cm:-none}', not ESP-IDF's copy" ;;
    esac
    case "$nj" in
        "$ESPRESSIF_DIR"/tools/ninja/*) ok "ninja -> $nj (ESP-IDF)" ;;
        *) warn "ninja resolves to '${nj:-none}', not ESP-IDF's copy" ;;
    esac
    if [[ -x "$CANONICAL_VENV/bin/python" ]]; then
        ok "venv: $CANONICAL_VENV"
        ok "venv Python: $("$CANONICAL_VENV/bin/python" --version 2>&1) ($("$CANONICAL_VENV/bin/python" -c 'import platform;print(platform.machine())'))"
        if [[ "$("$CANONICAL_VENV/bin/python" -c 'import platform;print(platform.machine())')" != "$CHIP_ARCH" ]]; then
            warn "venv arch != $CHIP_ARCH - ensure Rosetta is OFF."
        fi
    fi
}

# =========================================================
# 9. TERMINAL PATH + GUI ENVIRONMENT
#    FirmGen needs none of this any more: main.js appends /opt/homebrew/bin and
#    /usr/local/bin to the PATH its child processes get and finds the ESP-IDF venv itself,
#    and the engine finds doxygen/dot by absolute path. What is left only helps a terminal,
#    so it never replaces anything already there:
#      a) /etc/paths.d/homebrew   - read by path_helper in login shells (GUI apps never
#                                   run path_helper)
#      b) links in /usr/local/bin - only where no file or link exists yet
#      c) GUI environment         - the old LaunchAgent, and the session-wide
#                                   IDF_PYTHON_ENV_PATH it set, are removed unless
#                                   FIRMGEN_KEEP_LAUNCHAGENT=1
# =========================================================

# Append LINE to FILE (via sudo) unless FILE already has it as a whole line.
add_to_paths_d() {
    local file="$1" line="$2"
    if [[ -f "$file" ]] && grep -qxF "$line" "$file" 2>/dev/null; then
        skip "$file already contains $line"
        return 0
    fi
    install "Adding $line to $file (requires sudo)..."
    # Appended, never replaced: the file may hold other entries. A last line without a
    # newline would otherwise run into ours.
    if [[ -s "$file" && -n "$(tail -c 1 "$file")" ]]; then
        printf '\n%s\n' "$line" | sudo tee -a "$file" > /dev/null
    else
        printf '%s\n' "$line" | sudo tee -a "$file" > /dev/null
    fi
    ok "$file updated"
}

describe_path() {
    if [[ -L "$1" ]]; then echo "a link to $(readlink "$1")"; else echo "an existing file"; fi
}

# Link Homebrew's build/doc tools into LINK_DIR (default /usr/local/bin), never replacing
# what is there: CMake.app's command-line links, an Intel Homebrew's, a manual install.
# sudo is only asked for when a link is actually created.
link_build_tools() {
    local link_dir="${1:-/usr/local/bin}"
    local tool src dst
    echo
    echo "  Linking build tools into $link_dir (only where nothing exists yet)..."
    for tool in cmake ninja dfu-util ccache doxygen dot; do
        src="$BREW_PREFIX/bin/$tool"
        dst="$link_dir/$tool"
        if [[ ! -x "$src" ]]; then
            warn "$src not found - no link for $tool"
            continue
        fi
        # On an INTEL Mac, BREW_PREFIX *is* /usr/local, so src and dst are the same path.
        # `ln -s X X` would destroy the real binary and leave a link to itself.
        if [[ "$src" == "$dst" ]]; then
            skip "$tool already lives at $dst (no link needed)"
            continue
        fi
        if [[ -L "$dst" && "$(readlink "$dst")" == "$src" ]]; then
            skip "link already correct: $dst"
        elif [[ -e "$dst" || -L "$dst" ]]; then
            warn "$dst is $(describe_path "$dst") - left alone"
        else
            [[ -d "$link_dir" ]] || sudo mkdir -p "$link_dir"
            sudo ln -s "$src" "$dst"
            ok "linked: $dst -> $src"
        fi
    done
}

# Undo what install_dependencies.sh set up for GUI apps: its LaunchAgent, and the
# session-wide IDF_PYTHON_ENV_PATH. The variable is unset only when this installer set it:
# it equals the pinned venv, or the old agent file names it (an older run may have pinned
# another venv), so the file is read before it is deleted. A value set by anyone else is
# reported and left alone.
remove_launch_agent() {
    local agent="$1"
    local current ours=false
    current="$(launchctl getenv IDF_PYTHON_ENV_PATH 2>/dev/null || true)"
    if [[ -n "$current" ]]; then
        if [[ "$current" == "$CANONICAL_VENV" ]] \
            || { [[ -f "$agent" ]] && grep -qF "\"$current\"" "$agent" 2>/dev/null; }; then
            ours=true
        fi
    fi

    if [[ -f "$agent" ]]; then
        launchctl bootout "gui/$(id -u)" "$agent" 2>/dev/null \
            || launchctl unload "$agent" 2>/dev/null \
            || true
        rm -f "$agent"
        fix "Removed the old LaunchAgent: $agent"
    else
        skip "No LaunchAgent from an earlier run"
    fi

    if [[ -z "$current" ]]; then
        skip "IDF_PYTHON_ENV_PATH is not set for GUI apps"
        GUI_ENV_STATUS="not set (FirmGen finds its venv itself)"
    elif $ours; then
        if launchctl unsetenv IDF_PYTHON_ENV_PATH 2>/dev/null; then
            fix "Unset IDF_PYTHON_ENV_PATH for GUI apps (was $current)"
            # Running apps copied the value at launch (and pass it to their terminals).
            warn "Apps already open (VS Code, Terminal, ...) keep it until you quit and reopen them."
            GUI_ENV_STATUS="removed (FirmGen finds its venv itself)"
        else
            warn "Could not unset IDF_PYTHON_ENV_PATH for GUI apps - it goes away at the next login"
            GUI_ENV_STATUS="still set until the next login"
        fi
    else
        warn "IDF_PYTHON_ENV_PATH is set for GUI apps to $current - not by this installer, left alone"
        GUI_ENV_STATUS="left alone: $current"
    fi
}

# FIRMGEN_KEEP_LAUNCHAGENT=1: what install_dependencies.sh did, for a FirmGen .dmg built
# before 2026-09-29 (commit ef1085f7). Those builds never set IDF_PYTHON_ENV_PATH themselves,
# so their export.sh looks for idf5.5_py3.9_env (named after /usr/bin/python3) and ESP32
# builds fail without this.
install_launch_agent() {
    local agent="$1"
    warn "FIRMGEN_KEEP_LAUNCHAGENT=1: exporting IDF_PYTHON_ENV_PATH to every GUI app."
    warn "Other ESP-IDF versions will refuse to activate in apps opened from the Dock."
    launchctl setenv IDF_PYTHON_ENV_PATH "$CANONICAL_VENV" 2>/dev/null \
        && ok "launchctl setenv IDF_PYTHON_ENV_PATH (this login session)" \
        || warn "launchctl setenv failed (non-fatal)"

    mkdir -p "$(dirname "$agent")"
    cat > "$agent" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LAUNCH_AGENT_LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/sh</string>
        <string>-c</string>
        <string>launchctl setenv IDF_PYTHON_ENV_PATH "$CANONICAL_VENV"</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF
    launchctl unload "$agent" 2>/dev/null || true
    if launchctl load -w "$agent" 2>/dev/null; then
        ok "LaunchAgent installed -> GUI apps get IDF_PYTHON_ENV_PATH after each login"
        GUI_ENV_STATUS="exported to GUI apps (FIRMGEN_KEEP_LAUNCHAGENT=1)"
    else
        warn "Could not load LaunchAgent (non-fatal). File written: $agent"
        GUI_ENV_STATUS="LaunchAgent written but not loaded (FIRMGEN_KEEP_LAUNCHAGENT=1)"
    fi
}

configure_system_path() {
    echo
    echo "=== [9/12] Terminal PATH + GUI environment ==="

    add_to_paths_d "/etc/paths.d/homebrew" "$BREW_PREFIX/bin"
    link_build_tools "/usr/local/bin"

    echo
    echo "  IDF_PYTHON_ENV_PATH for GUI apps..."
    if [[ "${FIRMGEN_KEEP_LAUNCHAGENT:-0}" == "1" ]]; then
        install_launch_agent "$LAUNCH_AGENT"
    else
        remove_launch_agent "$LAUNCH_AGENT"
    fi
}

# =========================================================
# 10. SHELL PROFILE - ~/.zshrc
#    A managed block with Homebrew's shellenv and the firmgen_idf helper. Re-runs replace
#    the block in place - including the one install_dependencies.sh wrote, whose global
#    IDF_PYTHON_ENV_PATH export goes with it.
# =========================================================

# Print FILE without the managed block.
strip_shell_block() {
    awk -v start="$ZSH_MARKER" -v end="$ZSH_END_MARKER" '
        $0 == start { skip = 1; next }
        skip        { if ($0 == end) skip = 0; next }
        { print }
    ' "$1"
}

# True when the user's zsh startup files define get_idf outside our block (Espressif's guide
# has them add `alias get_idf='. $HOME/esp/esp-idf/export.sh'`), and sets OWN_GET_IDF_FILE.
# This only decides what to tell the user to type; the block itself checks at shell start.
user_has_own_get_idf() {
    local f
    for f in "$HOME/.zshenv" "$HOME/.zprofile" "$HOME/.zshrc" "$HOME/.zlogin"; do
        [[ -f "$f" ]] || continue
        if strip_shell_block "$f" | grep -v '^[[:space:]]*#' \
            | grep -Eq '(^|[;&|[:space:]])(alias[[:space:]]+get_idf=|get_idf[[:space:]]*\(\)|function[[:space:]]+get_idf([[:space:]{(]|$))'; then
            OWN_GET_IDF_FILE="$f"
            return 0
        fi
    done
    return 1
}

# Write the managed block to PROFILE, replacing an earlier one. PROFILE is left untouched
# when its start/end markers don't pair up: removing an unterminated block would delete
# everything below the start marker. Sets SHELL_BLOCK_STATUS.
write_shell_block() {
    local profile="$1"

    local starts=0 ends=0
    if [[ -f "$profile" ]]; then
        starts=$(grep -cxF "$ZSH_MARKER" "$profile" || true)
        ends=$(grep -cxF "$ZSH_END_MARKER" "$profile" || true)
    fi
    if [[ "$starts" != "$ends" ]]; then
        warn "$profile has $starts start and $ends end marker line(s) for the ESP-IDF block - not editing it."
        warn "Delete the block (or fix its markers) by hand, then re-run this script."
        SHELL_BLOCK_STATUS="skipped"
        return 0
    fi

    backup_once "$profile"

    if (( starts > 0 )); then
        fix "Replacing the ESP-IDF block in $profile"
        local tmp
        tmp="$(mktemp "${TMPDIR:-/tmp}/zshrc.XXXXXX")"
        # Drops the old block and any blank lines left trailing at the end, so re-runs don't
        # pile up empty lines. Copied back with `cat >`, not `mv`: a ~/.zshrc that is a
        # symlink into a dotfiles repo stays a symlink.
        awk -v start="$ZSH_MARKER" -v end="$ZSH_END_MARKER" '
            $0 == start      { skip = 1; next }
            skip             { if ($0 == end) skip = 0; next }
            /^[[:space:]]*$/ { held = held $0 "\n"; next }
            { printf "%s", held; held = ""; print }
        ' "$profile" > "$tmp"
        cat "$tmp" > "$profile"
        rm -f "$tmp"
    else
        install "Writing the ESP-IDF block to $profile"
    fi

    local brew_shellenv_line
    if [[ "$CHIP_TYPE" == "apple_silicon" ]]; then
        brew_shellenv_line='eval "$(/opt/homebrew/bin/brew shellenv)"'
    else
        brew_shellenv_line='eval "$(/usr/local/bin/brew shellenv)"'
    fi

    cat >> "$profile" << EOF

$ZSH_MARKER
# Homebrew - puts cmake, ninja, ccache, git, dfu-util on PATH
$brew_shellenv_line

# Activate ESP-IDF $ESP_IDF_SHORT in this terminal:  firmgen_idf  (or get_idf, see below)
# Homebrew Python $PYTHON_VERSION goes first on PATH so export.sh picks it, and the venv is
# pinned - inside the function only. Exported for every shell, it made all other ESP-IDF
# versions on this Mac refuse to activate (each venv records the IDF version that built it).
# 'function NAME {' because zsh rejects 'NAME() {' when NAME is already an alias.
function firmgen_idf {
    export PATH="$PINNED_PY_LIBEXEC:\$PATH"
    export IDF_PYTHON_ENV_PATH="$CANONICAL_VENV"
    . "$ESP_IDF_DIR/export.sh"
}

# get_idf too, unless something by that name exists already - e.g. the alias Espressif's
# guide has users add for their own ESP-IDF, which keeps working.
if ! whence get_idf >/dev/null 2>&1; then
    function get_idf { firmgen_idf "\$@"; }
fi
$ZSH_END_MARKER
EOF
    SHELL_BLOCK_STATUS="written"
}

configure_shell_profile() {
    echo
    echo "=== [10/12] Shell Profile (~/.zshrc) ==="

    write_shell_block "$HOME/.zshrc"
    [[ "$SHELL_BLOCK_STATUS" == "written" ]] || return 0

    if user_has_own_get_idf; then
        SHELL_HELPER="firmgen_idf"
        warn "Your own get_idf (in $OWN_GET_IDF_FILE) keeps working as before."
        warn "Use 'firmgen_idf' for FirmGen's ESP-IDF $ESP_IDF_SHORT."
    else
        SHELL_HELPER="get_idf"
    fi
    ok "~/.zshrc updated (firmgen_idf helper; IDF_PYTHON_ENV_PATH no longer exported to every shell)"
    warn "Run 'source ~/.zshrc' or open a new terminal, then type '$SHELL_HELPER'."
}

# =========================================================
# 11. CRAFTIFAI RUNTIME CONFIG (esp32_tools.yaml)
# =========================================================
detect_serial_port() {
    local port
    port=$(ls /dev/cu.usbmodem* /dev/cu.SLAB* /dev/cu.usbserial* 2>/dev/null | head -1)
    SERIAL_PORT="${port:-/dev/cu.usbmodem101}"
}

write_firmgen_config() {
    local dest="$1"
    mkdir -p "$(dirname "$dest")"
    # Keys must match what the engine's ESP32Config actually reads
    # (refact-agent/engine/src/tools/esp32_tools/config.rs). Unknown keys are silently
    # ignored, so esp_idf_export_script / esp_idf_python_env_path / sandbox_path used to
    # sit here doing nothing — the export-script path only matters to the desktop app,
    # and that now goes into settings.json (see write_desktop_settings).
    cat > "$dest" << EOF
# ESP32 Tools Configuration  (written by scripts/install_dependencies_v2.sh)
#
# NOTE: the desktop app REGENERATES this file from ~/.config/craftifai/settings.json
# every time it launches (main.js: syncEsp32Config). This copy is what refact-lsp reads
# before the app has ever run; after that, settings.json is the source of truth.
esp32_config:
  esp_idf_path: "$ESP_IDF_DIR"
  esp_idf_version: "5.5.0"
  projects_path: "$PROJECTS_DIR"

  # Must match the app's own default (main.js writes esp32s3) or the target silently
  # flips between "whatever the installer said" and "whatever the app said". Omitting it
  # is worse still: the Rust default is esp32p4.
  default_target: "esp32s3"

  # macOS serial port (Windows: COMx; Linux: /dev/ttyUSB0)
  default_serial_port: "$SERIAL_PORT"
  default_baud_rate: 921600
  default_flash_baud_rate: 921600
  default_monitor_baud_rate: 115200

  default_flash_mode: "dio"
  default_flash_freq: "80m"
  default_flash_size: "4MB"

  ota_enabled: false
  ota_partition_scheme: "default"
  cloud_provider: "none"
  mqtt_broker: ""

tools:
  esp32_project:   { enabled: true }
  esp32_build:     { enabled: true }
  esp32_device:    { enabled: true }
  esp32_config:    { enabled: true }
  esp32_component: { enabled: true }
  esp32_analyze:   { enabled: true }
EOF
}

# The desktop app's OWN settings file. This is the one that matters long-term.
#
# main.js rewrites every esp32_tools.yaml on each launch from these settings
# (syncEsp32Config), deriving esp_idf_path from `idf_export_sh`. When that is empty it
# scans ~/Espressif, ~/esp and /opt/esp for an export.sh and takes the path that sorts
# last, which with several ESP-IDF versions side by side need not be this one - so the
# path is seeded explicitly.
#
# Merge rather than overwrite: the file also holds the user's board, project dir and
# setup_complete flag. `setup_complete` is deliberately NOT set here — that belongs to
# the in-app Welcome flow, and forcing it would skip first-run login.
write_desktop_settings() {
    local settings_dir="$HOME/.config/craftifai"
    local settings_file="$settings_dir/settings.json"
    local export_sh="$ESP_IDF_DIR/export.sh"

    mkdir -p "$settings_dir"

    if [[ ! -f "$export_sh" ]]; then
        warn "export.sh not found at $export_sh - skipping settings.json seeding"
        return
    fi

    backup_once "$settings_file"

    "$PINNED_PYTHON" - "$settings_file" "$export_sh" "$PROJECTS_DIR" << 'PYEOF'
import json, os, sys

settings_file, export_sh, projects_dir = sys.argv[1:4]

data = {}
if os.path.isfile(settings_file):
    try:
        with open(settings_file, encoding="utf-8") as fh:
            loaded = json.load(fh)
        if isinstance(loaded, dict):
            data = loaded
    except (OSError, ValueError) as exc:
        # A corrupt file must not abort the install; the backup is already taken.
        print(f"  [WARN]    existing settings.json unreadable ({exc}) - starting fresh")

changed = []
if data.get("idf_export_sh") != export_sh:
    data["idf_export_sh"] = export_sh
    changed.append("idf_export_sh")
# Only fill projects_base when the user has not chosen one.
if not data.get("projects_base"):
    data["projects_base"] = projects_dir
    changed.append("projects_base")
# Keys main.js expects to exist on first run.
for key in ("board_definition", "project_dir"):
    data.setdefault(key, None)
data.setdefault("setup_complete", False)

os.makedirs(os.path.dirname(settings_file), exist_ok=True)
with open(settings_file, "w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=2)
    fh.write("\n")

print(f"  [OK]      settings.json {'updated: ' + ', '.join(changed) if changed else 'already correct'}")
print(f"  [OK]      idf_export_sh -> {data['idf_export_sh']}")
PYEOF
}

configure_firmgen() {
    echo
    echo "=== [11/12] CraftifAI Runtime Config (esp32_tools.yaml + settings.json) ==="

    detect_serial_port
    if ls /dev/cu.usbmodem* /dev/cu.SLAB* /dev/cu.usbserial* >/dev/null 2>&1; then
        ok "Detected serial port -> $SERIAL_PORT"
    else
        warn "No ESP32 connected - using default port $SERIAL_PORT (reconnect in the GUI once plugged in)"
    fi

    for CFG in "${FIRMGEN_CONFIG_PATHS[@]}"; do
        if [[ -f "$CFG" ]]; then
            fix "Updating $CFG"
            backup_once "$CFG"
        else
            install "Writing $CFG"
        fi
        write_firmgen_config "$CFG"
    done

    echo
    echo "  Seeding the desktop app's settings.json (so the app keeps these paths)..."
    write_desktop_settings

    ok "CraftifAI will use ESP-IDF at $ESP_IDF_DIR (venv pinned) and port $SERIAL_PORT"
}

# =========================================================
# 12. SUMMARY
# =========================================================
print_summary() {
    echo
    echo "=== [12/12] Summary ==="
    echo
    echo "  Chip      : $CHIP_MODEL"
    echo "  Arch      : $CHIP_ARCH"
    echo "  macOS     : $MACOS_VERSION"
    echo "  ESP-IDF   : $ESP_IDF_VERSION  ->  $ESP_IDF_DIR"
    echo "  Python    : $PINNED_PYTHON ($PYTHON_VERSION)"
    echo "  Venv      : $CANONICAL_VENV"
    echo "  Port      : $SERIAL_PORT  (CraftifAI default)"
    echo "  Doxygen   : $(command -v doxygen >/dev/null 2>&1 && doxygen --version 2>&1 | head -1 || echo 'NOT installed')"
    echo "  Graphviz  : $(command -v dot >/dev/null 2>&1 && (dot -V 2>&1 | head -1) || echo 'NOT installed (reports build without diagrams)')"
    echo "  cmake     : $(command -v cmake 2>/dev/null || echo 'NOT found')"
    echo "  ninja     : $(command -v ninja 2>/dev/null || echo 'NOT found')"
    echo "  ccache    : $(command -v ccache 2>/dev/null || echo 'NOT found (ESP32 builds run uncached)')"
    if [[ "$CHIP_TYPE" == "apple_silicon" ]]; then
        echo "  Rosetta 2 : $(rosetta_installed && echo installed || echo 'MISSING - STM32CubeCLT tools will not run')"
    fi
    echo "  GUI env   : IDF_PYTHON_ENV_PATH $GUI_ENV_STATUS"
    echo "  App config: $HOME/.config/craftifai/settings.json  (idf_export_sh seeded)"
    if [[ -n "$UNSUPPORTED_REASON" ]]; then
        echo
        warn "$UNSUPPORTED_REASON - the FirmGen app will not install on this Mac."
    fi
    echo
    if [[ "$SHELL_BLOCK_STATUS" == "written" ]]; then
        echo "  In every new terminal:"
        echo
        if [[ "$SHELL_HELPER" == "get_idf" ]]; then
            echo "    get_idf            # activates ESP-IDF (firmgen_idf does the same)"
        else
            echo "    firmgen_idf        # activates FirmGen's ESP-IDF; your own get_idf is unchanged"
        fi
    else
        echo "  ~/.zshrc was NOT changed (see step 10). To activate ESP-IDF in a terminal:"
        echo
        echo "    export PATH=\"$PINNED_PY_LIBEXEC:\$PATH\" IDF_PYTHON_ENV_PATH=\"$CANONICAL_VENV\""
        echo "    . \"$ESP_IDF_DIR/export.sh\""
    fi
    echo
    echo "  Then build a project, e.g.:"
    echo
    echo "    idf.py -C ~/Espressif/projects/blink set-target esp32s3 build"
    echo
    echo "  Why this won't break again: the helper forces python3=$PYTHON_VERSION and the venv"
    echo "  above before sourcing export.sh, and FirmGen picks that venv itself - so installing"
    echo "  other Python versions later can't make ESP-IDF hunt for a venv that doesn't exist."
    if [[ "$GUI_ENV_STATUS" == *FIRMGEN_KEEP_LAUNCHAGENT* ]]; then
        echo "  IDF_PYTHON_ENV_PATH IS exported to GUI apps (FIRMGEN_KEEP_LAUNCHAGENT=1), so other"
        echo "  ESP-IDF versions refuse to activate in apps opened from the Dock."
    else
        echo "  Nothing is exported to every shell or app, so other ESP-IDF versions keep working."
    fi
    echo
    echo "  Not installed: STM32CubeCLT + an STM32Cube FW package (STM32, from st.com) and"
    echo "  Code Composer Studio + C2000Ware (C2000, from ti.com)."
    echo
}

# =========================================================
# MAIN
# =========================================================
main() {
    echo
    echo "============================================"
    echo " ESP-IDF Installer for macOS (v2)"
    echo "============================================"

    detect_chip
    ensure_homebrew
    ensure_python
    ensure_git
    ensure_build_tools
    ensure_doc_tools
    ensure_rosetta
    install_esp_idf
    configure_system_path
    configure_shell_profile
    configure_firmgen
    print_summary

    echo "============================================"
    echo " Setup Complete"
    echo "============================================"
    echo
}

# Run only when executed, so the functions can be sourced and tested on their own.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
