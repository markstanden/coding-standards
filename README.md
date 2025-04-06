# Coding Standards

A single source of truth for my development project configuration files, workflow templates, and development tools to ensure consistency across projects.

## Project Structure

```bash
coding-standards/
└── dotnet/                               # .NET specific standards and tools
    ├── editorconfig/                     # Code formatting rules
    ├── directory-build-props/            # Common build properties
    ├── git-hooks/                        # .NET-specific git hooks
    ├── workflows/                        # GitHub Actions workflows for .NET
    └── setup.sh                          # Script to set up all .NET standards
```

## Getting Started

### As a Submodule

Add this repository as a submodule to your project:

```bash
git submodule add https://github.com/markstanden/coding-standards .coding-standards
```

### Using .NET Standards

Run the setup script to configure all .NET standards at once:

```bash
sudo chmod +x .coding-standards/dotnet/setup.sh
.coding-standards/dotnet/setup.sh
```

This will:

- Add this repository as a submodule to your project:
- Copy or symlink the `.editorconfig` and `Directory.Build.props` to your project root
- Set up git hooks for .NET formatting
- Create a GitHub Actions workflow pipeline file if it doesn't exist

### Manual Setup

The script essentially automates the following steps:

1. Symlink the `.editorconfig` to your project root:

```bash
ln -s .coding-standards/dotnet/editorconfig/.editorconfig .editorconfig
```

2. Symlink the `Directory.Build.props` to your project root:

```bash
ln -s .coding-standards/dotnet/directory-build-props/Directory.Build.props Directory.Build.props
```

3. Set up git hooks:

```bash
.coding-standards/dotnet/git-hooks/setup-hooks.sh
```

4. Set up GitHub workflows:

```bash
mkdir -p .github/workflows
cp .coding-standards/dotnet/workflows/pipeline.yml .github/workflows/
```
