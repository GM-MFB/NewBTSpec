// Worked examples, one per strategy, kept separate from the reference content
// so neither file becomes unmanageable.
//
// Each has a setup, the branches that can follow it, and a closing lesson.
// Numbers match the calculator defaults wherever possible so a reader can
// follow along on the diagram beside them.

export const STRATEGY_EXAMPLES = {
  wheel: {
    setup: 'SPY trades at $392. You would happily own it at $380, so you sell one 30-day $380 put and collect $2.00 — $200 into the account, with $38,000 set aside as collateral.',
    outcomes: [
      { label: 'SPY finishes above $380', detail: 'The put expires worthless. You keep the full $200 on $38,000 for 30 days — 0.53%, or about 6.4% annualised. Collateral is released and you sell the next one.', tone: 'good' },
      { label: 'SPY finishes at $374', detail: 'Assigned. You own 100 shares at $380, but you were paid $2.00, so your cost basis is $378. On paper you are down $400 against a stock trading at $374. Now you sell covered calls at or above $378.', tone: null },
      { label: 'SPY finishes at $300', detail: 'Assigned at a basis of $378 into a stock worth $300. That is $7,800 of unrealised loss, and no amount of covered call premium fixes it quickly. This is the risk the $200 was paying you to take.', tone: 'bad' },
    ],
    lesson: 'The first outcome happens most of the time. The third is what the premium is compensation for, and it is why the entry rule is "a stock you actually want to own" rather than "the best premium on the screen".',
  },

  pmcc: {
    setup: 'A $100 stock. Buying 100 shares costs $10,000. Instead you buy a 12-month $80 call for $25.00 — $2,500 — and sell a 30-day $110 call for $2.00. Net outlay $2,300, roughly a quarter of owning the shares.',
    outcomes: [
      { label: 'Stock sits at $100 for a month', detail: 'The short call expires worthless. You keep $200 and sell another, cutting your net cost to $2,100. Repeat that a few times and the long call is substantially paid for.', tone: 'good' },
      { label: 'Stock runs to $115', detail: 'The short call is in the money. Roll it up and out for a credit rather than being assigned — you do not own shares to deliver, so assignment forces you to exercise the long call or buy stock.', tone: null },
      { label: 'Stock falls to $85', detail: 'The long call is now barely in the money and has lost most of its value — far more than 15% in percentage terms. There is no share position to sell calls against comfortably, no dividend, and a hard expiry ahead.', tone: 'bad' },
    ],
    lesson: 'A quarter of the capital gets you most of the income and considerably more than a quarter of the pain on the way down. The leverage cuts both ways and it cuts harder downward.',
  },

  'jade-lizard': {
    setup: 'A stock at $100. You sell the $95 put, sell the $105 call and buy the $110 call. Total credit $5.20 — more than the $5 width of the call spread.',
    outcomes: [
      { label: 'Stock finishes at $102', detail: 'Everything expires worthless. You keep all $520. This is the ideal, and it covers a wide range of prices.', tone: 'good' },
      { label: 'Stock gaps to $140 on a takeover', detail: 'The call spread loses its full $5 width, but you collected $5.20. You still make $20. No price on the upside can hurt you — that is the entire point of sizing the credit above the width.', tone: 'good' },
      { label: 'Stock falls to $80', detail: 'The short put is $15 in the money. Against $5.20 of credit you are down $980, and it keeps going from there. The downside is a full cash-secured put and nothing about the structure changes that.', tone: 'bad' },
    ],
    lesson: 'The headline is "no upside risk", and it is true. Read the third row anyway — all the exposure moved to one side, it did not go away.',
  },

  'covered-strangle': {
    setup: 'You own 100 shares at a $100 basis. You sell the $110 call for $2.50 and the $95 put for $1.50 — $400 of premium against a position you already held.',
    outcomes: [
      { label: 'Stock finishes at $104', detail: 'Both expire worthless. You keep $400 on shares you were holding anyway, and you still own them. Best case.', tone: 'good' },
      { label: 'Stock finishes at $115', detail: 'Called away at $110. You make $10 on the shares plus $400 of premium — $1,400. Capped, but a good outcome.', tone: 'good' },
      { label: 'Stock finishes at $88', detail: 'The put is assigned. You now own 200 shares, at a blended basis of $95.50, in a stock trading at $88. Your position in this one name has doubled at exactly the moment it is falling.', tone: 'bad' },
    ],
    lesson: 'Size this at half what you would normally take, because assignment makes it the full position. The premium is paid for accepting a second helping you did not choose the timing of.',
  },

  'long-option': {
    setup: 'A stock at $98 that you think runs to $110 within two months. You buy the $100 call, 60 days out, for $3.00 — $300, and that is the whole risk.',
    outcomes: [
      { label: 'Stock hits $110 in three weeks', detail: 'The call is worth at least $10 of intrinsic plus remaining time value. Roughly a triple. This is why people buy options.', tone: 'good' },
      { label: 'Stock hits $110 — the week after expiry', detail: 'You lose the entire $300. You were right on direction and size and still lost everything, because the third thing you had to be right about was timing.', tone: 'bad' },
      { label: 'Stock drifts to $102', detail: 'The call is worth about $2 of intrinsic with little time left. You needed $103 to break even, so being right on direction was not enough.', tone: 'bad' },
    ],
    lesson: 'Three things have to go right: direction, magnitude, and timing. Every other structure on this page exists partly to reduce how many of those you need.',
  },

  'credit-spread': {
    setup: 'A $38 stock. You sell the $36 put and buy the $35 put, 35 days out, for $0.40 credit. Max profit $40, max loss $60, and the broker holds $60.',
    outcomes: [
      { label: 'Stock stays above $36', detail: 'Both expire worthless. You keep $40 on $60 of risk — a 67% return on capital in five weeks.', tone: 'good' },
      { label: 'Stock finishes at $35.60', detail: 'Exactly breakeven. The spread is $0.40 in the money, which is precisely the credit you took.', tone: null },
      { label: 'Stock finishes at $34', detail: 'Full width loss. You lose $60. There is no assignment to fall back on and no shares to sell calls against — the spread just settles.', tone: 'bad' },
    ],
    lesson: 'Risking $60 to make $40 needs a win rate well above 60% to break even. The high probability is doing real work here, and one loss undoes more than one win.',
  },

  'debit-spread': {
    setup: 'A stock at $99 you expect to reach about $105. You buy the $100 call and sell the $105 call for $2.00 net — $200 risked, $300 to gain.',
    outcomes: [
      { label: 'Stock finishes at $105 or above', detail: 'Maximum profit of $300 on $200 risked. The short call caps you, but $105 was your target, so you gave up nothing you expected.', tone: 'good' },
      { label: 'Stock finishes at $102', detail: 'Exactly breakeven — $100 strike plus the $2.00 paid. The stock rose 3% and you made nothing.', tone: null },
      { label: 'Stock finishes at $99', detail: 'You lose the full $200. A plain long call would also have lost, but the spread cost less to begin with.', tone: 'bad' },
    ],
    lesson: 'Compared with buying the $100 call outright at maybe $3.50, this breaks even a dollar and a half sooner. The price of that is everything above $105.',
  },

  'ratio-spread': {
    setup: 'A stock at $98. You buy one $100 call and sell two $110 calls, taking $1.00 of credit. The maximum is at $110; one of those short calls is uncovered.',
    outcomes: [
      { label: 'Stock finishes at $110', detail: 'Perfect. The long call is $10 in the money, both shorts expire worthless, and you keep the credit — $1,100.', tone: 'good' },
      { label: 'Stock finishes below $100', detail: 'Everything expires worthless and you keep the $100 credit. The near side cannot lose because you opened for a credit.', tone: 'good' },
      { label: 'Stock gaps to $140', detail: 'Past $121 you are losing. At $140 you are down $1,900, and there is nothing stopping it. The naked short call runs one for one with the stock, forever.', tone: 'bad' },
    ],
    lesson: 'A 1x2 has one uncovered contract however good the credit looks. The chart shows a neat tent right up until the point where the right-hand side simply keeps going down.',
  },

  'iron-condor': {
    setup: 'An index at $100, quiet. You sell the $95 put and buy the $90 put; sell the $105 call and buy the $110 call. Total credit $1.20, max loss $380.',
    outcomes: [
      { label: 'Index finishes between $95 and $105', detail: 'Everything expires worthless and you keep $120. The profit zone is a ten-point range, which is why this suits things that chop.', tone: 'good' },
      { label: 'Index finishes at $107', detail: 'The call spread is $2 in the money. You lose $200 against $120 collected — down $80. Bad, but nowhere near the maximum.', tone: null },
      { label: 'Index finishes at $112', detail: 'Full loss on the call side: $380. The put side expired worthless and contributed nothing, which is why max loss uses the wider wing and not the sum of both.', tone: 'bad' },
    ],
    lesson: 'Collecting $120 against $380 of risk means roughly three winners are needed per loser just to hold even. That is the trade, and closing at 50% is how people tilt it.',
  },

  'iron-butterfly': {
    setup: 'A stock at $100 before an event, with elevated volatility. You sell the $100 put and call, buy the $90 put and $110 call. Credit $4.00, max loss $600.',
    outcomes: [
      { label: 'Stock finishes at exactly $100', detail: 'The full $400. This essentially never happens, and it is the number the structure advertises.', tone: 'good' },
      { label: 'Stock finishes at $102', detail: 'The short call is $2 in the money, so you keep $200 of the $400. Still a good result, and far more typical than the peak.', tone: 'good' },
      { label: 'Stock finishes at $108', detail: 'Down $400. Just eight points from where you centred it and the trade is a substantial loser — the payoff is a peak, not a plateau.', tone: 'bad' },
    ],
    lesson: 'It collects far more than a condor because it needs the stock to finish far closer to one price. Compare the two diagrams side by side; the butterfly is a spike and the condor is a table.',
  },

  'broken-wing': {
    setup: 'A stock at $103 you think will drift down but not collapse. You buy the $105 put, sell two $100 puts and buy the $90 put, taking $1.00 of credit.',
    outcomes: [
      { label: 'Stock finishes at $100', detail: 'The peak. The $105 put is $5 in the money, the shorts expire at the money, and you keep the credit — $600.', tone: 'good' },
      { label: 'Stock rallies to $115', detail: 'Everything expires worthless and you keep the $100 credit. The narrow side is risk-free because you opened for a credit — being wrong upward costs nothing.', tone: 'good' },
      { label: 'Stock falls to $88', detail: 'Past the wide wing you are at max loss: $400. All the risk lives on the side you skewed away from, which is the side you said would not happen.', tone: 'bad' },
    ],
    lesson: 'A directional bet you get paid to place, provided you put the wide wing where you genuinely do not expect the stock to go.',
  },

  'calendar-spread': {
    setup: 'A stock pinned around $100 with low implied volatility. You sell the 30-day $100 call and buy the 60-day $100 call, paying $1.50 net — $150, and that is the maximum you can lose.',
    outcomes: [
      { label: 'Stock sits at $100 and IV rises', detail: 'The near call decays to nothing while the far call holds its value and gains on volatility. The best case, and it needs both things to go right.', tone: 'good' },
      { label: 'Stock sits at $100 and IV falls', detail: 'Decay works for you, volatility works against you. The two partly cancel and the result is a small profit or a small loss depending on which dominated.', tone: null },
      { label: 'Stock runs to $120', detail: 'Both calls are deep in the money and their values converge. The structure was a bet on stillness, and the stock did not oblige. Most of the $150 is gone.', tone: 'bad' },
    ],
    lesson: 'Note that none of these outcomes has a clean number attached. That is exactly why the calculator gives a max loss and refuses to give a max profit.',
  },

  strangle: {
    setup: 'A stock at $100 with high implied volatility before earnings. You sell the $95 put and the $105 call for $3.00 total — $300 collected, naked on both sides.',
    outcomes: [
      { label: 'Earnings pass quietly, stock at $101', detail: 'Both expire worthless. You keep $300, and the volatility crush after the announcement helped you get there faster.', tone: 'good' },
      { label: 'Stock drops to $88', detail: 'The put is $7 in the money. You are down $400 and it continues from there. Painful but survivable.', tone: 'bad' },
      { label: 'Stock gaps to $150 on a buyout', detail: 'The short call is $45 in the money. You are down $4,200 on a trade that collected $300, and no stop protected you because it gapped overnight.', tone: 'bad' },
    ],
    lesson: 'The third row is why brokers demand so much margin and why the page marks the risk undefined. Wings bought either side turn this into an iron condor and cap that outcome — usually the better trade.',
  },

  'protective-put': {
    setup: 'You hold 100 shares at a $100 basis, up nicely, and you are nervous. You buy the $95 put for $2.00. Adding a $110 call sold for $1.50 turns it into a collar costing $0.50 net.',
    outcomes: [
      { label: 'Stock falls to $70', detail: 'Unhedged you would be down $3,000. With the put your loss stops at $700 — the $5 to the strike plus the $2 the put cost. The insurance did exactly its job.', tone: 'good' },
      { label: 'Stock rises to $130 (protective put)', detail: 'You are up $3,000 less the $200 the put cost. The put capped nothing; you simply paid a small toll for a quiet twelve weeks.', tone: 'good' },
      { label: 'Stock rises to $130 (collar)', detail: 'Called away at $110. You make $950 instead of $2,950. The call paid for the put, and it cost you two thousand dollars of a rally you did not get to keep.', tone: 'bad' },
    ],
    lesson: 'The collar is close to free in cash and expensive in outcomes when you are right. That trade-off is the entire decision and it should be made before, not after.',
  },

  'vol-risk-premium': {
    setup: 'A year of selling 30-delta puts on an index. Twelve trades, one a month, each collecting about $200 against $38,000 of collateral.',
    outcomes: [
      { label: 'Ten months pass uneventfully', detail: 'Ten winners at roughly $200 each — $2,000 collected. Every month looks like nothing happening, which is what the edge feels like when it is working.', tone: 'good' },
      { label: 'One month is a mild drawdown', detail: 'A small loser, or an assignment you manage out of. Down a few hundred. Ordinary.', tone: null },
      { label: 'One month is a genuine crash', detail: 'The index falls 20% in three weeks. That single position loses several thousand — more than the other eleven months made together. And every other short position you held lost at the same time.', tone: 'bad' },
    ],
    lesson: 'The edge is real and it is not free money. A 90% win rate says nothing about expectancy when the 10% is ten times the size, and the losses arrive together rather than spread out politely.',
  },

  'tail-hedge': {
    setup: 'A $100,000 portfolio. You buy two SPX-equivalent puts 20% out of the money, roughly $1.50 each, rolled quarterly. Cost: about $1,200 a year — 1.2% of the portfolio.',
    outcomes: [
      { label: 'A normal year', detail: 'Every put expires worthless. You are down $1,200 and have nothing to show for it. This is the outcome in most years and it is why almost nobody sticks with the programme.', tone: 'bad' },
      { label: 'A 10% correction', detail: 'Still nothing — the puts are 20% out of the money. You lose $10,000 on the portfolio and the hedge does not engage. Corrections are not what this protects against.', tone: 'bad' },
      { label: 'A 40% crash', detail: 'The portfolio is down $40,000. The puts are $100 in the money, paying $20,000. Half the loss is covered, and volatility spiking on the way down means monetising early would likely have paid more.', tone: 'good' },
    ],
    lesson: 'Two rows out of three lose money, and the middle row is the one that catches people out — this is crash insurance, not correction insurance. The programme is judged on decades, not years.',
  },

  'risk-reversal': {
    setup: 'A stock at $100 after a selloff, with put skew steep. The $95 put trades at 32% implied volatility, the $110 call at 22%. You sell the put and buy the call for $0.50 net credit.',
    outcomes: [
      { label: 'Stock recovers to $125', detail: 'The call is $15 in the money. You make $1,550 including the credit, on a position that cost nothing to put on.', tone: 'good' },
      { label: 'Stock sits at $102', detail: 'Both expire worthless and you keep $50. The flat stretch between the strikes is where nothing happens either way.', tone: null },
      { label: 'Stock falls to $80', detail: 'The short put is $15 in the money — down $1,450. Identical to having simply owned the shares from $95, which is what the structure is.', tone: 'bad' },
    ],
    lesson: 'Zero cost is not zero risk. The skew paid you to take share-like downside, and share-like downside is exactly what you got.',
  },

  buffer: {
    setup: 'A $100,000 position you want to hold through an uncertain year. You build a structure with a 15% buffer and a 12% cap over twelve months.',
    outcomes: [
      { label: 'Market falls 10%', detail: 'The buffer absorbs all of it. You end flat while an unhedged holder is down $10,000. This is the case the structure is built for.', tone: 'good' },
      { label: 'Market falls 30%', detail: 'The buffer absorbs the first 15%, and the remaining 15% is yours — down $15,000. A buffer is not a floor, and past it losses resume one for one.', tone: 'bad' },
      { label: 'Market rises 25%', detail: 'You get 12%. The cap cost you thirteen percentage points, which in dollars is $13,000 of a rally you watched from behind glass.', tone: 'bad' },
    ],
    lesson: 'Two of the three rows are worse than doing nothing. You buy this for the first one, and only if the first one is what you are actually afraid of.',
  },

  gamma: {
    setup: 'The same short $95 put on a $100 stock, considered at two moments: 45 days to expiry, and 2 days to expiry. Nothing about the position changes — only the time left.',
    outcomes: [
      { label: 'At 45 DTE, stock drops $3 to $97', detail: 'The put gains maybe $0.60. Uncomfortable, easily managed, and there is time for the stock to recover. Delta is around 0.25 and moving slowly.', tone: null },
      { label: 'At 2 DTE, stock drops $3 to $97', detail: 'The same $3 move, and now the put is worth several times more. Delta has lurched toward 0.5 and is still climbing. There is no time left for a recovery.', tone: 'bad' },
      { label: 'At 2 DTE, stock drops $6 to $94', detail: 'Delta is near 1. The position is now behaving exactly like being short 100 shares, and it got there in a single session.', tone: 'bad' },
    ],
    lesson: 'Identical position, identical move, wildly different outcomes. That difference is gamma, and it is the whole reason for closing at 50% and managing at 21 DTE.',
  },

  hedging: {
    setup: 'A $100,000 portfolio with a beta of 1.2 — it moves about 20% more than the index. A full hedge means offsetting $120,000 of notional, which at an index price of $600 is two contracts.',
    outcomes: [
      { label: 'Market falls 20%, fully hedged', detail: 'The portfolio loses $24,000 and the hedge makes $24,000. Net zero. You sat out the crash entirely.', tone: 'good' },
      { label: 'Market rises 20%, fully hedged', detail: 'The portfolio gains $24,000 and the hedge loses $24,000. Also net zero. A full hedge is indistinguishable from having sold everything, except that it costs more.', tone: 'bad' },
      { label: 'The same book, but $30,000', detail: 'Beta-adjusted you need $36,000 hedged — 0.6 of a contract. You cannot buy 0.6. One contract over-hedges by two thirds and leaves you net short the market.', tone: 'bad' },
    ],
    lesson: 'The second row is why funds hedge partially rather than fully, and the third is why small accounts often should not hedge at all. Holding less achieves the same thing, for free, and in any size you like.',
  },
}

export function exampleFor(id) {
  return STRATEGY_EXAMPLES[id] ?? null
}
