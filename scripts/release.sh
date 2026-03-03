#!/bin/bash

# Prefetch SDK Release Script
# Interactive CLI for publishing packages

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Icons
CHECK="✓"
CROSS="✗"
ARROW="→"
PACKAGE="📦"
ROCKET="🚀"

print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}    ${PACKAGE} ${GREEN}Prefetch SDK Release${NC}    ${PACKAGE}     ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}${ARROW}${NC} $1"
}

print_success() {
    echo -e "${GREEN}${CHECK}${NC} $1"
}

print_error() {
    echo -e "${RED}${CROSS}${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

# Check if we're in the right directory
check_directory() {
    if [ ! -f "package.json" ] || [ ! -d ".changeset" ]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
}

# Check git status
check_git_status() {
    print_step "Checking git status..."

    if [ -n "$(git status --porcelain)" ]; then
        print_warning "You have uncommitted changes:"
        git status --short
        echo ""
        read -p "Continue anyway? (y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            print_error "Aborted"
            exit 1
        fi
    else
        print_success "Working directory is clean"
    fi
}

# Check npm login status
check_npm_auth() {
    print_step "Checking npm authentication..."

    if npm whoami &> /dev/null; then
        local user=$(npm whoami)
        print_success "Logged in as: ${user}"
    else
        print_error "Not logged in to npm"
        echo ""
        read -p "Login now? (Y/n): " login
        if [ "$login" != "n" ] && [ "$login" != "N" ]; then
            npm login
        else
            print_error "Please login to npm first: npm login"
            exit 1
        fi
    fi
}

# Show current package versions
show_versions() {
    print_step "Current package versions:"
    echo ""

    for pkg in packages/*/package.json; do
        local name=$(grep '"name"' "$pkg" | head -1 | sed 's/.*: "\(.*\)".*/\1/')
        local version=$(grep '"version"' "$pkg" | head -1 | sed 's/.*: "\(.*\)".*/\1/')
        echo -e "  ${CYAN}${name}${NC} @ ${GREEN}${version}${NC}"
    done
    echo ""
}

# Check for pending changesets
check_changesets() {
    local changeset_files=$(find .changeset -name "*.md" ! -name "README.md" 2>/dev/null | wc -l | tr -d ' ')

    if [ "$changeset_files" -gt 0 ]; then
        print_success "Found ${changeset_files} pending changeset(s)"
        return 0
    else
        print_warning "No pending changesets found"
        return 1
    fi
}

# Menu: Add changeset
add_changeset() {
    print_step "Adding new changeset..."
    echo ""
    pnpm changeset
    echo ""
    print_success "Changeset added"
}

# Menu: Version packages
version_packages() {
    if ! check_changesets; then
        print_error "No changesets to consume. Run 'Add changeset' first."
        return 1
    fi

    print_step "Updating package versions..."
    echo ""
    pnpm changeset version
    echo ""
    print_success "Versions updated"

    show_versions

    read -p "Commit version changes? (Y/n): " commit
    if [ "$commit" != "n" ] && [ "$commit" != "N" ]; then
        git add .
        git commit -m "chore: release packages"
        print_success "Changes committed"
    fi
}

# Menu: Build packages
build_packages() {
    print_step "Building all packages..."
    echo ""
    pnpm build
    echo ""
    print_success "Build completed"
}

# Menu: Publish packages
publish_packages() {
    check_npm_auth

    print_step "Publishing packages to npm..."
    echo ""

    read -p "Publish with tag (default: latest): " tag
    tag=${tag:-latest}

    if [ "$tag" = "latest" ]; then
        pnpm changeset publish
    else
        pnpm changeset publish --tag "$tag"
    fi

    echo ""
    print_success "Packages published"

    read -p "Push to git remote? (Y/n): " push
    if [ "$push" != "n" ] && [ "$push" != "N" ]; then
        git push --follow-tags
        print_success "Pushed to remote"
    fi
}

# Menu: Full release (version + build + publish)
full_release() {
    echo ""
    print_warning "This will version, build, and publish all packages."
    read -p "Continue? (y/N): " confirm

    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        print_error "Aborted"
        return 1
    fi

    version_packages
    build_packages
    publish_packages

    echo ""
    echo -e "${GREEN}${ROCKET} Release completed! ${ROCKET}${NC}"
}

# Menu: Dry run
dry_run() {
    print_step "Running publish dry run..."
    echo ""
    pnpm changeset publish --dry-run
    echo ""
    print_success "Dry run completed (no packages were published)"
}

# Main menu
show_menu() {
    echo -e "${YELLOW}Select an option:${NC}"
    echo ""
    echo "  1) Add changeset      - Record changes for release"
    echo "  2) Version packages   - Update versions from changesets"
    echo "  3) Build packages     - Build all packages"
    echo "  4) Publish packages   - Publish to npm"
    echo "  5) Full release       - Version + Build + Publish"
    echo "  6) Dry run            - Test publish without uploading"
    echo "  7) Show versions      - Display current versions"
    echo "  8) Check status       - Check git & npm status"
    echo "  0) Exit"
    echo ""
}

main() {
    print_header
    check_directory

    while true; do
        show_menu
        read -p "Enter choice [0-8]: " choice
        echo ""

        case $choice in
            1) add_changeset ;;
            2) version_packages ;;
            3) build_packages ;;
            4) publish_packages ;;
            5) full_release ;;
            6) dry_run ;;
            7) show_versions ;;
            8)
                check_git_status
                check_npm_auth
                check_changesets
                ;;
            0)
                echo -e "${GREEN}Goodbye!${NC}"
                exit 0
                ;;
            *)
                print_error "Invalid option"
                ;;
        esac

        echo ""
        read -p "Press Enter to continue..."
        clear
        print_header
    done
}

# Run
main
