<!--
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
-->

# ReleaseMe - GitHub Release Management

A GitHub Action to create GitHub Releases based on the [Conventional Commits] since the latest release.

## Features

- Simple to use
- Automatic creation of GitHub Releases
- Configurable changelog

## Usage

```yaml
name: GitHub Release

concurrency: deployment

on:
  push:
    branches:
      - main

permissions:
  contents: write

jobs:
  release-me:
    name: Create GitHub Release
    runs-on: ubuntu-latest
    steps:
      - name: Run ReleaseMe
        id: release
        uses: dev-build-deploy/release-me@v0
        with:
          token: ${{ github.token }}
          prefix: v  # OPTIONAL; prefixes the Semantic Verion with v (e.g. v1.0.0)

      - if: ${{ steps.release.outputs.created }}
        run: echo ${{ fromJSON(steps.release.outputs.release).tag_name }}
```

## Inputs

| Key | Description |
| --- | --- |
| `token` | GitHub token used to access GitHub |
| `prefix` | Prefix for the Semantic Version, MUST be one of `[A-Za-z0-9-.]` |

## Outputs

| Key | Description |
| --- | --- |
| `created` | Set to `true` when a release was created, otherwise the output is not set |
| `release` | [Release object](./src/release.ts) containing relevant information about the created release. Only set when `created` is set to `true`.|

## Permissions

| Permission | Value | Description |
| --- | --- | --- |
| `contents` | `write` | Required to create new GitHub Releases (and push tags) |

## Contributing

If you have suggestions for how release-me could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

- [GPL-3.0-or-later AND CC0-1.0](LICENSE) © 2023 Kevin de Jong \<monkaii@hotmail.com\>


[Conventional Commits]: https://www.conventionalcommits.org/en/v1.0.0/