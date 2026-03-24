#!/bin/bash
# EmpireOS — Einmaliges VPS-Setup (Ubuntu 22.04 / 24.04)
# Auf dem VPS ausführen: bash setup-vps.sh

set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║      EmpireOS — VPS Setup            ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Docker installieren
if ! command -v docker >/dev/null 2>&1; then
  echo "[1/3] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "      Done."
else
  echo "[1/3] Docker already installed — skip."
fi

# Docker Compose Plugin
if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
  echo "[2/3] Installing Docker Compose plugin..."
  apt-get install -y docker-compose-plugin 2>/dev/null || \
    curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
      -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose
  echo "      Done."
else
  echo "[2/3] Docker Compose already installed — skip."
fi

# Git
if ! command -v git >/dev/null 2>&1; then
  echo "[3/3] Installing git..."
  apt-get update -qq && apt-get install -y git
else
  echo "[3/3] Git already installed — skip."
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  VPS ready! Jetzt das Repo klonen und deployen:          ║"
echo "║                                                          ║"
echo "║  git clone https://github.com/DamianLipusic/            ║"
echo "║      awesome-claude-code.git                             ║"
echo "║                                                          ║"
echo "║  cd awesome-claude-code/game                             ║"
echo "║  cp server/.env.prod.example server/.env                 ║"
echo "║  nano server/.env    # Secrets eintragen!                ║"
echo "║                                                          ║"
echo "║  # JWT_SECRET generieren:                                ║"
echo "║  openssl rand -hex 64                                    ║"
echo "║                                                          ║"
echo "║  ./deploy.sh                                             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
