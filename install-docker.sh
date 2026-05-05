#!/usr/bin/env bash
# Docker CE install script for Rocky Linux 9 / RHEL 9
# Run as root: sudo bash install-docker.sh

set -euo pipefail

echo "==> Removing old Docker packages (if any)..."
dnf remove -y docker docker-client docker-client-latest docker-common \
    docker-latest docker-latest-logrotate docker-logrotate docker-engine \
    podman runc 2>/dev/null || true

echo "==> Installing prerequisites..."
dnf install -y dnf-plugins-core curl

echo "==> Adding Docker CE repository..."
dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo

echo "==> Installing Docker CE (latest)..."
dnf install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

echo "==> Starting and enabling Docker daemon..."
systemctl start docker
systemctl enable docker

echo "==> Adding user '${SUDO_USER:-$USER}' to docker group..."
TARGET_USER="${SUDO_USER:-rushikesh.sakharle}"
usermod -aG docker "$TARGET_USER"

echo ""
echo "Docker version:"
docker --version

echo ""
echo "Docker Compose version:"
docker compose version

echo ""
echo "==> Done! Log out and back in (or run 'newgrp docker') for group to take effect."
echo "    Then run: cd /home/rushikesh.sakharle/Projects/ServerInventory && docker compose up --build"
