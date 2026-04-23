# Solana Memecoin Trading Bot

Self-learning ML-basierter Trading Bot für Solana Memecoins. Der Bot lernt automatisch aus Paper Trades und optimiert seine Strategie mit Machine Learning.

## Features

- **Self-Learning ML**: XGBoost/Random Forest Model das aus jedem Trade lernt
- **Paper Trading**: Risikofreies Testen mit virtuellem Guthaben
- **Live Trading**: Echte Trades via Jupiter Aggregator
- **Backtesting**: Strategien auf historischen Daten testen
- **Multi-Source Daten**: Jupiter, Raydium, pump.fun
- **Risk Management**: Kelly Criterion, Stop-Loss, Trailing Stop, Max Drawdown
- **Speed-Optimiert**: HTTP/2, Connection Pooling, Price Cache, parallele Requests
- **VPS Ready**: systemd Service, Auto-Restart, Monitoring

## Schnellstart

```bash
# 1. Installation
chmod +x scripts/install.sh
./scripts/install.sh

# 2. Konfiguration anpassen
nano config/config.yaml
nano .env

# 3. Paper Trading starten
source venv/bin/activate
python main.py --mode paper

# 4. Backtesting (optional)
python main.py --backtest --data data/historical/

# 5. Status prüfen
python main.py --status
```

## Architektur

```
solana-trading-bot/
├── main.py                    # CLI Entry Point
├── bot/
│   ├── engine.py              # Hauptengine (orchestriert alles)
│   ├── models.py              # Datenmodelle
│   ├── database.py            # SQLite Storage
│   ├── backtester.py          # Backtesting Engine
│   ├── data_collector/        # Datensammlung
│   │   ├── jupiter.py         # Jupiter API
│   │   ├── raydium.py         # Raydium API
│   │   ├── pump_fun.py        # pump.fun API
│   │   └── aggregator.py      # Feature Berechnung
│   ├── ml_engine/             # Machine Learning
│   │   ├── model.py           # XGBoost/RF Trading Model
│   │   └── feature_engineer.py # Feature Engineering
│   ├── trading/               # Trade Execution
│   │   ├── paper_trader.py    # Paper Trading
│   │   ├── live_trader.py     # Live Trading (Jupiter Swap)
│   │   └── risk_manager.py    # Risk Management
│   └── utils/
│       ├── logger.py          # Structured Logging
│       └── speed.py           # Latency Tracking & Caching
├── config/
│   └── config.yaml            # Konfiguration
├── scripts/
│   ├── install.sh             # VPS Installation
│   └── monitor.sh             # Monitoring
└── data/                      # Daten (auto-generiert)
```

## Wie der Bot lernt

1. **Phase 1 - Paper Trading**: Bot handelt mit virtuellem Geld, sammelt Daten
2. **Phase 2 - Feature Collection**: Für jeden Trade werden 16+ Features gespeichert (Momentum, RSI, MACD, Volume, Holder Count, etc.)
3. **Phase 3 - ML Training**: Nach genug Samples (default: 100) trainiert der Bot ein XGBoost Model
4. **Phase 4 - Continuous Learning**: Model wird alle 6h neu trainiert mit aktuellen Daten
5. **Phase 5 - Live Trading**: Wenn Paper Trading profitabel ist, Umschaltung auf echte Wallet

## ML Features

| Feature | Beschreibung |
|---------|-------------|
| price_change_Xm | Preisänderung über X Minuten |
| price_volatility | Preis-Volatilität (Standardabweichung) |
| momentum_score | Momentum-Indikator |
| rsi | Relative Strength Index |
| macd_signal | MACD Signal Line |
| buy_sell_ratio | Kauf/Verkauf-Druck |
| liquidity_depth | Liquiditätstiefe in USD |
| volume_24h | 24h Handelsvolumen |
| holder_count | Anzahl Token-Halter |
| volume_profile | Volumen-Profil Änderung |

## Risk Management

- **Kelly Criterion**: Optimale Positionsgröße basierend auf Gewinnwahrscheinlichkeit
- **Stop-Loss**: Automatischer Verkauf bei 20% Verlust (konfigurierbar)
- **Take-Profit**: Automatischer Verkauf bei 50% Gewinn
- **Trailing Stop**: 10% Trailing Stop nach Gewinnzone
- **Max Drawdown**: Trading stoppt bei 25% Drawdown
- **Daily Loss Limit**: Max 10% Tagesverlust
- **Cooldown**: 15 Min Pause nach Verlust-Trade
- **Rate Limit**: Max 10 Trades pro Stunde

## VPS Deployment

```bash
# Als systemd Service installieren
sudo cp /tmp/solana-trading-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable solana-trading-bot
sudo systemctl start solana-trading-bot

# Logs anschauen
sudo journalctl -u solana-trading-bot -f

# Status
./scripts/monitor.sh
```

## Von Paper zu Live Trading

1. Paper Trading mindestens 1-2 Wochen laufen lassen
2. `python main.py --status` prüfen - ist die Win Rate > 50%?
3. Wenn ja:
   - `SOLANA_PRIVATE_KEY` in `.env` setzen
   - In `config/config.yaml`: `mode: "live"` ändern
   - `max_sol_per_trade` niedrig anfangen (0.05 SOL)
   - Bot neustarten

## Wichtige Hinweise

- **Kein finanzieller Rat** - Trading ist riskant, du kannst alles verlieren
- **Starte mit Paper Trading** - Teste die Strategie bevor du echtes Geld einsetzt
- **Kleine Positionen** - Fange mit minimalen Beträgen an
- **Überwache den Bot** - Lass ihn nicht unbeaufsichtigt mit großen Summen laufen
- **RPC Endpoint** - Für Speed einen bezahlten RPC nutzen (Helius, QuickNode)
