import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '../store/gameStore';
import { STOCKS } from '../data/stocks';
import { formatMoney } from '../utils/formatMoney';
import { getPortfolioValue, getPortfolioPnL } from '../utils/gameLogic';

export function StocksScreen() {
  const {
    money,
    totalEarned,
    stockPrices,
    stockHoldings,
    tickStocks,
    buyStock,
    sellStock,
  } = useGameStore();

  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const unlocked = totalEarned >= 50_000;

  useEffect(() => {
    tickRef.current = setInterval(() => tickStocks(), 5000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const portfolioValue = getPortfolioValue(stockHoldings, stockPrices);
  const pnl = getPortfolioPnL(stockHoldings, stockPrices);

  if (!unlocked) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.locked}>
          <Text style={styles.lockEmoji}>📈</Text>
          <Text style={styles.lockTitle}>Stock Market</Text>
          <Text style={styles.lockDesc}>Earn {formatMoney(50_000)} to unlock</Text>
          <Text style={styles.lockProgress}>Current: {formatMoney(totalEarned)}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const selected = selectedStock ? STOCKS.find(s => s.id === selectedStock) : null;
  const selectedPrice = selectedStock ? stockPrices[selectedStock] || 0 : 0;
  const holding = selectedStock ? stockHoldings[selectedStock] : null;
  const qty = parseInt(quantity) || 1;
  const buyCost = selectedPrice * qty;
  const sellProceeds = selectedPrice * qty;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>📈 Stock Market</Text>

        {/* Portfolio Summary */}
        <View style={styles.portfolioCard}>
          <View style={styles.portfolioRow}>
            <View style={styles.portfolioItem}>
              <Text style={styles.portfolioValue}>{formatMoney(portfolioValue)}</Text>
              <Text style={styles.portfolioLabel}>Portfolio Value</Text>
            </View>
            <View style={styles.portfolioItem}>
              <Text style={[styles.portfolioValue, pnl >= 0 ? styles.green : styles.red]}>
                {pnl >= 0 ? '+' : ''}{formatMoney(pnl)}
              </Text>
              <Text style={styles.portfolioLabel}>Unrealized P&L</Text>
            </View>
            <View style={styles.portfolioItem}>
              <Text style={styles.portfolioValue}>{formatMoney(money)}</Text>
              <Text style={styles.portfolioLabel}>Cash</Text>
            </View>
          </View>
        </View>

        {/* Stock List */}
        {STOCKS.map(stock => {
          const price = stockPrices[stock.id] || stock.basePrice;
          const myHolding = stockHoldings[stock.id];
          const isSelected = selectedStock === stock.id;
          const priceChange = ((price - stock.basePrice) / stock.basePrice) * 100;

          return (
            <TouchableOpacity
              key={stock.id}
              style={[styles.stockCard, isSelected && styles.selectedCard]}
              onPress={() => {
                setSelectedStock(isSelected ? null : stock.id);
                Haptics.selectionAsync();
              }}
            >
              <View style={styles.stockLeft}>
                <Text style={styles.stockEmoji}>{stock.emoji}</Text>
                <View>
                  <Text style={styles.stockName}>{stock.name}</Text>
                  <Text style={styles.stockTicker}>{stock.ticker} · {stock.sector}</Text>
                  {myHolding && (
                    <Text style={styles.stockOwned}>
                      {myHolding.shares.toFixed(0)} shares · avg {formatMoney(myHolding.avgBuyPrice)}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.stockRight}>
                <Text style={styles.stockPrice}>{formatMoney(price)}</Text>
                <Text style={[styles.stockChange, priceChange >= 0 ? styles.green : styles.red]}>
                  {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(1)}%
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Trade Panel */}
        {selected && (
          <View style={styles.tradePanel}>
            <Text style={styles.tradeTitle}>Trade {selected.name}</Text>
            <Text style={styles.tradePrice}>Price: {formatMoney(selectedPrice)}</Text>

            <View style={styles.qtyRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(String(Math.max(1, qty - 1)))}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.qtyInput}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                selectTextOnFocus
              />
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(String(qty + 1))}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.qtyMax} onPress={() => {
                const maxShares = Math.floor(money / selectedPrice);
                setQuantity(String(Math.max(1, maxShares)));
              }}>
                <Text style={styles.qtyMaxText}>MAX</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tradeBtns}>
              <TouchableOpacity
                style={[styles.buyBtn, money < buyCost && styles.disabledBtn]}
                onPress={() => {
                  if (money >= buyCost) {
                    buyStock(selected.id, qty);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                }}
              >
                <Text style={styles.tradeBtnLabel}>BUY</Text>
                <Text style={styles.tradeBtnCost}>{formatMoney(buyCost)}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sellBtn, (!holding || holding.shares < qty) && styles.disabledBtn]}
                onPress={() => {
                  if (holding && holding.shares >= qty) {
                    sellStock(selected.id, qty);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                }}
              >
                <Text style={styles.tradeBtnLabel}>SELL</Text>
                <Text style={styles.tradeBtnCost}>{formatMoney(sellProceeds)}</Text>
              </TouchableOpacity>
            </View>

            {holding && (
              <Text style={styles.holdingInfo}>
                You own: {holding.shares.toFixed(0)} shares · Value: {formatMoney(selectedPrice * holding.shares)}
              </Text>
            )}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { paddingHorizontal: 16, paddingBottom: 30 },
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  lockEmoji: { fontSize: 64, marginBottom: 16 },
  lockTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  lockDesc: { color: '#888', fontSize: 16, textAlign: 'center' },
  lockProgress: { color: '#FFD700', fontSize: 14, marginTop: 8 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', paddingVertical: 18 },

  portfolioCard: {
    backgroundColor: '#12122a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  portfolioRow: { flexDirection: 'row', justifyContent: 'space-around' },
  portfolioItem: { alignItems: 'center' },
  portfolioValue: { color: '#FFD700', fontWeight: '800', fontSize: 15 },
  portfolioLabel: { color: '#666', fontSize: 11, marginTop: 2 },

  stockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#12122a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  selectedCard: { borderColor: '#FFD700' },
  stockLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  stockEmoji: { fontSize: 28 },
  stockName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  stockTicker: { color: '#666', fontSize: 11, marginTop: 1 },
  stockOwned: { color: '#4ade80', fontSize: 11, marginTop: 2 },
  stockRight: { alignItems: 'flex-end' },
  stockPrice: { color: '#fff', fontWeight: '700', fontSize: 15 },
  stockChange: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  green: { color: '#4ade80' },
  red: { color: '#f87171' },

  tradePanel: {
    backgroundColor: '#0d1117',
    borderRadius: 16,
    padding: 18,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  tradeTitle: { color: '#FFD700', fontWeight: '900', fontSize: 18, marginBottom: 4 },
  tradePrice: { color: '#888', fontSize: 13, marginBottom: 14 },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  qtyBtn: {
    backgroundColor: '#2a2a4a',
    borderRadius: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  qtyInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    padding: 8,
    flex: 1,
    borderWidth: 1,
    borderColor: '#333',
  },
  qtyMax: {
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  qtyMaxText: { color: '#FFD700', fontWeight: '700', fontSize: 12 },

  tradeBtns: { flexDirection: 'row', gap: 10 },
  buyBtn: {
    flex: 1,
    backgroundColor: '#4ade80',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sellBtn: {
    flex: 1,
    backgroundColor: '#f87171',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabledBtn: { opacity: 0.4 },
  tradeBtnLabel: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  tradeBtnCost: { color: '#00000099', fontWeight: '600', fontSize: 12 },
  holdingInfo: { color: '#888', fontSize: 12, marginTop: 10, textAlign: 'center' },
});
