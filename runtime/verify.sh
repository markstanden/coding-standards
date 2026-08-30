#!/usr/bin/env bash
# Defined runtime shim — the only host-side surface.
#
# Locates a container engine, ensures the pinned image exists (builds it on
# first run or when tool pins change), mounts the target repo rw and
# runtime/ + lib/ + standards/ ro, then execs verify.mts inside the container.
#
# Usage: ./runtime/verify.sh [--fix] [--silent] [step flags...]
#
# Engine preference is podman → docker: podman adheres more strictly to OCI
# semantics, so developing against it keeps the image honest; docker's
# leniency means anything that runs here runs there too.

set -euo pipefail

RUNTIME_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
GATE_ROOT="$(dirname "${RUNTIME_DIR}")"
LIB_DIR="${GATE_ROOT}/lib"
STANDARDS_DIR="${GATE_ROOT}/standards"

# Repo root comes from the invocation CWD's git root — never from where this
# script lives — so the gate can run against any checkout.
REPO_ROOT="$(git -C "${PWD}" rev-parse --show-toplevel)" || {
	echo "ERROR: not inside a git repository (run from within the target project)" >&2
	exit 1
}

# Repo identity for named shadow volumes (decision #3): dependencies are
# restored *inside* the container so host↔image ABI mismatches (e.g. Arch-built
# native modules) never leak in. Volumes are keyed by this hash so two checkouts
# of the same repo share one restore cache.
REPO_HASH="$(printf '%s' "${REPO_ROOT}" | sha256sum | cut -c1-12)"

if command -v podman >/dev/null 2>&1; then
	ENGINE="podman"
elif command -v docker >/dev/null 2>&1; then
	ENGINE="docker"
else
	echo "ERROR: no container engine found. Install podman or docker:" >&2
	echo "  see runtime/Containerfile for the supported base" >&2
	exit 1
fi

PINHASH="$(sha256sum "${RUNTIME_DIR}/tool-versions.env" | cut -c1-12)"
IMAGE="localhost/defined:${PINHASH}"

# Base image pins come from tool-versions.env — the single source of truth —
# and are injected as build args because FROM needs them before COPY.
# shellcheck source=runtime/tool-versions.env
source "${RUNTIME_DIR}/tool-versions.env"

if ! "${ENGINE}" image inspect "${IMAGE}" >/dev/null 2>&1; then
	echo "Building ${IMAGE} ..."
	"${ENGINE}" build \
		-f "${RUNTIME_DIR}/Containerfile" \
		--build-arg "NODE_IMAGE_TAG=${NODE_IMAGE_TAG}" \
		--build-arg "NODE_IMAGE_DIGEST=${NODE_IMAGE_DIGEST}" \
		-t "${IMAGE}" "${GATE_ROOT}"
fi

exec "${ENGINE}" run --rm \
	-v "${REPO_ROOT}:/repo" \
	-v "${RUNTIME_DIR}:/opt/defined/runtime:ro" \
	-v "${LIB_DIR}:/opt/defined/lib:ro" \
	-v "${STANDARDS_DIR}:/opt/defined/standards:ro" \
	-v "defined-node-${PINHASH}-${REPO_HASH}:/repo/node_modules" \
	-v "defined-npm-${REPO_HASH}:/root/.npm" \
	-v "defined-nuget-${REPO_HASH}:/root/.nuget/packages" \
	-e "NUGET_PACKAGES=/root/.nuget/packages" \
	--workdir /repo \
	"${IMAGE}" "$@"
