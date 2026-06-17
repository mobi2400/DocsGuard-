from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

DOCGUARD_NPM_PACKAGE = "@mobasshirkhan/docguard"

INSTALL_COMMANDS: dict[str, list[str]] = {
    "npm": ["npm", "install", "--save-dev", DOCGUARD_NPM_PACKAGE],
    "pnpm": ["pnpm", "add", "-D", DOCGUARD_NPM_PACKAGE],
    "yarn": ["yarn", "add", "-D", DOCGUARD_NPM_PACKAGE],
    "bun": ["bun", "add", "-d", DOCGUARD_NPM_PACKAGE],
}

EXEC_COMMANDS: dict[str, list[str]] = {
    "npm": ["npx", "docguard"],
    "pnpm": ["pnpm", "exec", "docguard"],
    "yarn": ["yarn", "exec", "docguard"],
    "bun": ["bunx", "docguard"],
}

PACKAGE_MANAGERS: tuple[str, ...] = ("npm", "pnpm", "yarn", "bun")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="docguard",
        description="Bootstrap DocGuard inside a Python or mixed-language repository.",
    )
    parser.add_argument(
        "--cwd",
        default=".",
        help="Repository path to operate on. Defaults to the current working directory.",
    )
    parser.add_argument(
        "--package-manager",
        choices=("auto", *PACKAGE_MANAGERS),
        default="auto",
        help="JavaScript package manager to use for installing and running DocGuard.",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    install = subparsers.add_parser(
        "install",
        help="Install the npm package and optionally run `docguard init`.",
    )
    install.add_argument(
        "--skip-init",
        action="store_true",
        help="Install DocGuard without running `docguard init`.",
    )

    subparsers.add_parser("init", help="Run `docguard init` through the selected package manager.")
    subparsers.add_parser("check", help="Run `docguard check` through the selected package manager.")
    uninstall = subparsers.add_parser(
        "uninstall",
        help="Run `docguard uninstall` through the selected package manager.",
    )
    uninstall.add_argument(
        "--purge",
        action="store_true",
        help="Also remove `.docguard.json`.",
    )

    return parser.parse_args(argv)


def fail(message: str) -> int:
    sys.stderr.write(f"docguard: {message}\n")
    return 1


def detect_package_manager(choice: str) -> str:
    if choice != "auto":
        return choice

    for manager in PACKAGE_MANAGERS:
        if shutil.which(manager) is not None:
            return manager

    raise RuntimeError(
        "No supported JavaScript package manager found. Install npm, pnpm, yarn, or bun first."
    )


def ensure_repo(path: Path) -> None:
    if not (path / ".git").exists():
        raise RuntimeError(f"{path} is not a Git repository. Run this inside your project root.")


def ensure_binaries(package_manager: str) -> None:
    missing: list[str] = []
    if shutil.which("node") is None:
        missing.append("node")
    if shutil.which(package_manager) is None:
        missing.append(package_manager)

    if package_manager == "npm" and shutil.which("npx") is None:
        missing.append("npx")
    if package_manager == "bun" and shutil.which("bunx") is None:
        missing.append("bunx")

    if missing:
        joined = ", ".join(missing)
        raise RuntimeError(f"Missing required executable(s): {joined}.")


def resolve_command(command: list[str]) -> list[str]:
    executable = shutil.which(command[0])
    if executable is None:
        raise RuntimeError(f"Executable not found: {command[0]}")
    return [executable, *command[1:]]


def run(command: list[str], cwd: Path) -> None:
    completed = subprocess.run(resolve_command(command), cwd=str(cwd), check=False)
    if completed.returncode != 0:
        rendered = " ".join(command)
        raise RuntimeError(f"Command failed with exit code {completed.returncode}: {rendered}")


def exec_docguard(package_manager: str, cwd: Path, *args: str) -> None:
    base = EXEC_COMMANDS[package_manager]
    run([*base, *args], cwd)


def handle_install(package_manager: str, cwd: Path, skip_init: bool) -> int:
    run(INSTALL_COMMANDS[package_manager], cwd)
    if not skip_init:
        exec_docguard(package_manager, cwd, "init")
    return 0


def handle_command(args: argparse.Namespace) -> int:
    cwd = Path(args.cwd).resolve()
    ensure_repo(cwd)
    package_manager = detect_package_manager(args.package_manager)
    ensure_binaries(package_manager)

    if args.command == "install":
        return handle_install(package_manager, cwd, args.skip_init)
    if args.command == "init":
        exec_docguard(package_manager, cwd, "init")
        return 0
    if args.command == "check":
        exec_docguard(package_manager, cwd, "check")
        return 0
    if args.command == "uninstall":
        uninstall_args = ["uninstall"]
        if args.purge:
            uninstall_args.append("--purge")
        exec_docguard(package_manager, cwd, *uninstall_args)
        return 0
    return fail(f"Unsupported command: {args.command}")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        return handle_command(args)
    except RuntimeError as err:
        return fail(str(err))
    except KeyboardInterrupt:
        return fail("Interrupted.")


if __name__ == "__main__":
    raise SystemExit(main())
