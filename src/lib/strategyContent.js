// Reference content for the Strategy page. Kept as data rather than JSX so all
// five strategies stay the same shape and a sixth is a data addition, not a new
// component.
//
// Shapes worth knowing:
//   glance      — the comparison strip; every strategy answers the same 5 questions
//   legs        — { action: 'sell' | 'buy' | 'hold', text }, drawn as a trade ticket
//   entry       — { lead, detail }, drawn as checklist cards
//   management  — { when, detail }, drawn as a timeline down the trade's life
//   mistakes    — { lead, detail }, drawn as warning cards

export const STRATEGY_CONTENT = [
  {
    id: 'wheel',
    group: 'Income',
    name: 'The Wheel',
    outlook: 'Neutral to bullish',
    capital: 'High — full strike collateral per contract',
    glance: {
      risk: 'Undefined',
      riskTone: 'bad',
      direction: 'Neutral / bullish',
      volatility: 'Sell high IV',
      capital: 'High',
      legs: '1 at a time',
    },
    summary:
      'Sell cash-secured puts on a stock you would be content to own. Collect premium while the put expires worthless, and repeat. If assigned, you own 100 shares per contract and switch to selling covered calls against them until the shares are called away — at which point you are back to selling puts. The income is the premium; the risk is that you end up holding a stock that keeps falling.',
    legs: [
      { action: 'sell', text: '1 put at your chosen strike — collateral is strike × 100' },
      { action: 'hold', text: 'If assigned: 100 shares per contract, basis = strike − premium' },
      { action: 'sell', text: '1 call at or above that basis, against the shares' },
    ],
    keyFacts: [
      ['Max profit', 'The premium collected, on each leg', 'good'],
      ['Max loss', 'Strike minus premium, per share, if the stock goes to zero', 'bad'],
      ['Breakeven (put leg)', 'Strike − premium collected', null],
      ['Capital required', 'Strike × 100 per contract, held as collateral', null],
    ],
    entry: [
      { lead: 'Only names you want to own', detail: 'This is the entire risk control. If you would not buy the shares at that strike, do not sell the put — premium never compensates for a stock you did not want.' },
      { lead: '0.16 – 0.30 delta', detail: 'Far enough out of the money to usually expire worthless, close enough to pay meaningfully for the collateral tied up.' },
      { lead: '30 – 45 days out', detail: 'Time decay accelerates through this window while the premium is still worth collecting.' },
      { lead: 'Elevated implied volatility', detail: 'You are selling volatility. In a low-IV market you are paid little for identical downside.' },
      { lead: 'Size for assignment', detail: 'If every open put being assigned at once would wreck the account, the position is too big. Correlated drawdowns assign everything together.' },
    ],
    management: [
      { when: 'Entry', detail: 'Collateral is locked. Premium lands in the account immediately.' },
      { when: '~50% profit', detail: 'A common close. The remaining premium takes disproportionately longer to earn than the first half did.' },
      { when: '21 DTE', detail: 'Decide: close, roll, or accept assignment. Gamma rises sharply from here and the position gets twitchy.' },
      { when: 'Rolling', detail: 'Roll out, and down if you can do it for a credit. A roll that costs a debit is paying to postpone a loss.' },
      { when: 'Assignment', detail: 'Not a failure. You now own a stock you said you wanted, below where it was. Switch to covered calls.' },
    ],
    mistakes: [
      { lead: 'Chasing premium instead of picking names', detail: 'High premium is the market pricing high risk, and it is usually right. The stock you got paid most to underwrite is the one most likely to fall.' },
      { lead: 'Selling calls below cost basis', detail: 'Locks in a loss the moment you are called away. This is the single most common way a profitable-looking wheel turns negative.' },
      { lead: 'Using the strike as cost basis', detail: 'Your basis is strike minus premium collected. Forgetting that makes the position look worse than it is and pushes you into bad decisions.' },
      { lead: 'Too many names at once', detail: 'Selling puts across more tickers than the account could actually take assignment on. They correlate in exactly the drawdown where it matters.' },
      { lead: 'Rolling for a debit, repeatedly', detail: 'Each roll should bring in a credit. Paying to extend is adding money to a loser and calling it management.' },
    ],
    extraSections: [
      {
        title: 'The cycle',
        body: [],
      },
      {
        title: 'What assignment does to your cost basis',
        body: [
          'Assignment happens at the strike, but the strike is not your cost basis — you were paid a premium to take the shares.',
          'Sell a $380 put for $2.00 and get assigned: you paid $380 per share and were paid $2.00, so your basis is $378.',
          'This matters on the way out. A covered call at $379 looks like it is below the strike you were assigned at, but it is above your basis, so being called away is a small win rather than a loss.',
          'Every subsequent covered call premium lowers the basis further. Tracking that number, not the assignment strike, is what tells you whether the wheel is actually working on this name.',
        ],
      },
      {
        title: 'Never sell a covered call below your cost basis',
        body: [
          'This is the single most common way a profitable-looking wheel turns negative.',
          'Assigned at $378 basis, the stock drops to $340, and the $345 call is paying well. Sell it, the stock rallies to $360, and you are called away at $345 — a $33 per share loss, crystallised, in exchange for a couple of dollars of premium.',
          'If the shares are underwater and no call above your basis pays anything worth having, the correct move is usually to sell nothing and wait, or to accept the loss deliberately rather than have a call decide it for you.',
          'The covered call calculator below shows this outcome as a negative number on purpose. Set the call strike under the cost basis and watch it turn red.',
        ],
      },
      {
        title: 'When the stock craters',
        body: [
          'The wheel is a strategy for stocks that trade sideways or grind up. A name in genuine decline turns it into a slow-motion bag hold with a small income stream attached.',
          'Warning sign: the premium you can collect above your cost basis has become negligible. The wheel has stopped turning and you are simply long a falling stock.',
          'The options then are the same as for any losing position — hold with conviction, average down deliberately, take the loss, or hedge. A protective put puts a floor under the shares, and a collar pays for that floor by capping the upside; see Protective Puts & Collars.',
          'Selling covered calls below basis is not one of those options. It is choosing the loss without admitting it.',
          'The defence is still mostly at entry: only wheel names you would hold through a drawdown. But once you are holding one, a floor is a real choice and worth pricing before deciding.',
        ],
      },
    ],
    calculator: 'wheel',
  },

  {
    id: 'credit-spread',
    group: 'Directional',
    name: 'Credit Spreads',
    outlook: 'Directional or neutral, with defined risk',
    capital: 'Low — the spread width less the credit',
    glance: {
      risk: 'Defined',
      riskTone: 'good',
      direction: 'Directional',
      volatility: 'Sell high IV',
      capital: 'Low',
      legs: '2',
    },
    summary:
      'Sell an option and buy a further out-of-the-money option in the same expiry. You take in a net credit, and the long leg caps your loss at the width of the spread. A put credit spread profits if the stock stays above the short strike; a call credit spread if it stays below. It is the defined-risk answer to a cash-secured put — far less capital, and a far smaller maximum profit.',
    legs: [
      { action: 'sell', text: '1 option closer to the money — this is what pays' },
      { action: 'buy', text: '1 option further out, same expiry — this caps the loss' },
    ],
    keyFacts: [
      ['Max profit', 'The net credit received', 'good'],
      ['Max loss', 'Spread width − credit', 'bad'],
      ['Breakeven', 'Put: short strike − credit. Call: short strike + credit', null],
      ['Capital required', 'The max loss — brokers hold width − credit', null],
    ],
    entry: [
      { lead: '0.16 – 0.30 delta short strike', detail: 'Same reasoning as the wheel: probability of expiring worthless weighed against premium collected.' },
      { lead: '30 – 45 days out', detail: 'The decay window, again. Shorter gets twitchy, longer ties up margin for little extra credit.' },
      { lead: 'Sell into high IV', detail: 'Credit spreads are short volatility. A low-IV credit spread pays badly for identical defined risk.' },
      { lead: 'Credit ≥ a third of the width', detail: 'Below that the risk/reward stops justifying the tail. $0.40 on a $1 wide spread risks $60 to make $40; $0.15 risks $85 to make $15.' },
      { lead: 'Width is a risk dial', detail: 'Wider collects more but risks more. Choose the width from what you can afford to lose, not from the credit it shows.' },
    ],
    management: [
      { when: 'Entry', detail: 'Credit received. Broker holds width − credit as margin.' },
      { when: '~50% profit', detail: 'Close. Same logic as any short-premium position — the back half of the credit is the slow, risky half.' },
      { when: '21 DTE', detail: 'Manage. A defined-risk spread can still go from comfortable to full-width loss in the last days.' },
      { when: 'Short strike tested', detail: 'Roll out for a credit if the thesis holds. If it does not, take the loss while it is still less than the max.' },
      { when: 'Expiry', detail: 'There is no assignment escape hatch here. The spread simply settles at full loss if it finishes in the money.' },
    ],
    mistakes: [
      { lead: 'Confusing small capital with small risk', detail: 'The low margin invites sizing up until the aggregate max loss across positions is enormous.' },
      { lead: 'Spreads too narrow to survive costs', detail: 'Commissions and slippage on two legs eat a meaningful share of a thin credit.' },
      { lead: 'Hoping through expiration', detail: 'Holding an in-the-money spread for a reversal. Max loss arrives fast at the end and there is no shares-based fallback.' },
      { lead: 'Leaving the long leg open', detail: 'Closing only the short leg turns a defined-risk spread into a naked directional bet.' },
    ],
    calculator: 'credit-spread',
  },

  {
    id: 'debit-spread',
    group: 'Directional',
    name: 'Debit Spreads',
    outlook: 'Directional, with defined risk and capped upside',
    capital: 'The debit paid',
    glance: {
      risk: 'Defined',
      riskTone: 'good',
      direction: 'Directional',
      volatility: 'Buy low IV',
      capital: 'Low',
      legs: '2',
    },
    summary:
      'Buy an option and sell a further out-of-the-money option in the same expiry. You pay a net debit, which is the entire risk. The short leg subsidises the purchase in exchange for capping the profit at the spread width. It is a cheaper, lower-breakeven way to express a directional view than buying the option outright — at the cost of giving up the unlimited tail.',
    legs: [
      { action: 'buy', text: '1 option closer to the money — the directional bet' },
      { action: 'sell', text: '1 option further out, same expiry — subsidy, and the cap' },
    ],
    keyFacts: [
      ['Max profit', 'Spread width − debit paid', 'good'],
      ['Max loss', 'The debit paid, in full', 'bad'],
      ['Breakeven', 'Call: long strike + debit. Put: long strike − debit', null],
      ['Capital required', 'The debit', null],
    ],
    entry: [
      { lead: 'Have a target, not just a direction', detail: 'The short strike should sit near where you expect the move to stop. You gain nothing beyond it, so paying for width past your target is wasted.' },
      { lead: 'Prefer low IV', detail: 'You are net long premium here — the mirror image of every other strategy on this page. Cheap options help you.' },
      { lead: '45 – 60 days out', detail: 'Give the thesis room. Time decay is working against you, so a spread that is right but slow still loses.' },
      { lead: 'Pay under two thirds of the width', detail: 'Beyond that you are risking a lot to make a little — a $5 spread bought for $3.50 risks $350 to make $150.' },
    ],
    management: [
      { when: 'Entry', detail: 'Debit paid. That is the entire risk, locked from this moment.' },
      { when: 'Thesis playing out', detail: 'Take profit when a good fraction of the width is captured. The last portion only arrives at expiration.' },
      { when: 'Time passing', detail: 'Decay is the opponent, unlike every short-premium strategy here. Being right slowly is still losing.' },
      { when: 'Thesis broken', detail: 'Close. There is no cheap roll for a debit spread — extending means paying again.' },
    ],
    mistakes: [
      { lead: 'Buying into high IV', detail: 'Being right on direction and still losing as volatility contracts is the classic debit-spread disappointment.' },
      { lead: 'Short strike past any real target', detail: 'Paying for width the stock will never reach. It raises the debit and the breakeven for nothing.' },
      { lead: 'Holding for the last few dollars', detail: 'Sitting through expiration week on a spread already most of the way to max profit, risking the whole gain for a fraction of it.' },
    ],
    calculator: 'debit-spread',
  },

  {
    id: 'calendar-spread',
    group: 'Neutral',
    name: 'Calendar Spreads',
    outlook: 'Neutral near-term, and long volatility',
    capital: 'The net debit paid',
    glance: {
      risk: 'Defined',
      riskTone: 'good',
      direction: 'Neutral',
      volatility: 'Buy low IV',
      capital: 'Low',
      legs: '2',
    },
    summary:
      'Sell a near-dated option and buy a longer-dated option at the same strike. The near leg decays faster than the far leg, and that differential is the profit engine. It also gains if implied volatility rises, because the long-dated option has more vega. It wants the underlying to sit near the strike through the near-term expiry — a genuinely neutral position with an unusual profit profile.',
    legs: [
      { action: 'sell', text: '1 option at the strike, near-dated — decays fast, in your favour' },
      { action: 'buy', text: '1 option at the same strike, further out — decays slower, holds value' },
    ],
    keyFacts: [
      ['Max profit', 'Not calculable in closed form — see below', null],
      ['Max loss', 'The net debit paid', 'bad'],
      ['Breakeven', 'Two, and both move with implied volatility', null],
      ['Capital required', 'The debit', null],
    ],
    entry: [
      { lead: 'Strike where you expect it to land', detail: 'Usually at the money for a neutral view. The profit zone is a range around this strike, not a direction.' },
      { lead: 'Enter when IV is low', detail: 'You want volatility to rise. It helps the long-dated leg more than the short, because the far leg has more vega.' },
      { lead: 'Roughly 30 and 60 days', detail: 'A common structure. Enough gap that the decay differential is real and worth having.' },
      { lead: 'Mind the earnings date', detail: 'An earnings report inside the near leg is a different trade entirely. The volatility crush afterwards can gut the position.' },
    ],
    management: [
      { when: 'Entry', detail: 'Debit paid. Both legs open at the same strike, different expiries.' },
      { when: 'Underlying drifts', detail: 'A large move either way hurts. The position wants the stock to sit still near the strike.' },
      { when: 'Near expiry approaches', detail: 'Usually closed as a unit before the near leg expires, rather than held through it.' },
      { when: 'Early assignment', detail: 'If the near leg is assigned — more likely on in-the-money calls before a dividend — the structure breaks and needs attention immediately.' },
    ],
    mistakes: [
      { lead: 'Expecting a max profit number', detail: 'There is not one. Any tool showing you a confident figure is modelling assumptions it has not disclosed.' },
      { lead: 'Entering when IV is already high', detail: 'Puts your vega exposure the wrong way round, so the thing meant to help you hurts instead.' },
      { lead: 'Letting the near leg expire in the money', detail: 'Unexpected assignment leaves you holding a naked long-dated option plus a stock position you did not plan.' },
      { lead: 'Treating it as income', detail: 'It is not a set-and-forget premium seller. It needs the underlying to cooperate on both price and volatility.' },
    ],
    extraSections: [
      {
        title: 'Why there is no max profit number',
        body: [
          'Every other strategy on this page settles into a fixed payoff at expiration, so max profit is arithmetic.',
          'A calendar does not. When the near leg expires, the far leg is still alive, and what it is worth then depends on implied volatility at that moment and on how close the underlying is to the strike.',
          'Both of those are unknowable at entry. Profit is highest when the stock sits exactly at the strike at the near expiry with volatility elevated — but "highest" there is a function of inputs that do not exist yet.',
          'So the calculator reports max loss, which is fixed and knowable, and reports nothing for max profit. There is no payoff diagram here either, for the same reason: the curve would be a model output dressed up as a fact.',
        ],
      },
    ],
    calculator: 'calendar-spread',
  },

  {
    id: 'iron-condor',
    group: 'Neutral',
    name: 'Iron Condors',
    outlook: 'Neutral — a bet on a range',
    capital: 'The wider wing width, less the credit',
    glance: {
      risk: 'Defined',
      riskTone: 'good',
      direction: 'Neutral',
      volatility: 'Sell high IV',
      capital: 'Low',
      legs: '4',
    },
    summary:
      'A put credit spread and a call credit spread on the same underlying and expiry, bracketing the current price. You collect both credits and keep them all if the stock finishes between the short strikes. It is the purest expression of "this is going nowhere" — defined risk on both sides, and a profit zone rather than a direction.',
    legs: [
      { action: 'buy', text: '1 put far below — lower wing' },
      { action: 'sell', text: '1 put below the price — lower short strike' },
      { action: 'sell', text: '1 call above the price — upper short strike' },
      { action: 'buy', text: '1 call far above — upper wing' },
    ],
    keyFacts: [
      ['Max profit', 'The total credit, if price finishes between the short strikes', 'good'],
      ['Max loss', 'Wider wing width − credit. Only one side can lose', 'bad'],
      ['Breakevens', 'Short put − credit, and short call + credit', null],
      ['Capital required', 'The max loss — brokers margin the wider side only', null],
    ],
    entry: [
      { lead: '~0.16 delta on each side', detail: 'A common starting point, giving a wide profit range with credit still worth collecting.' },
      { lead: '30 – 45 days out', detail: 'As with the other short-premium structures.' },
      { lead: 'Sell into high IV', detail: 'A condor is short volatility on both sides at once and wants IV to fall after entry.' },
      { lead: 'Equal wings unless deliberate', detail: 'Matching widths mean the margin is the same whichever side is tested, and the risk is easier to reason about.' },
      { lead: 'Range-bound underlyings', detail: 'Best on indices and stocks that chop. A trending name will run straight through a wing.' },
    ],
    management: [
      { when: 'Entry', detail: 'Both credits received. Broker margins the wider wing only.' },
      { when: '~50% profit', detail: 'Close. Holding a condor to expiration for the last of the credit is where the losses come from.' },
      { when: 'One side tested', detail: 'Manage the threatened spread alone — roll it out or further away for a credit. The untested side is doing its job.' },
      { when: '21 DTE', detail: 'Decide. Gamma near expiry is what turns a comfortable condor into a full-width loss in a single day.' },
    ],
    mistakes: [
      { lead: 'Wings too close for more credit', detail: 'Tightening the short strikes converts a range bet into a coin flip, and the credit never compensates enough.' },
      { lead: 'Misreading the risk', detail: 'Assuming both sides can lose overstates it; netting them understates the margin. Only one side can finish in the money.' },
      { lead: 'Condors on trending names', detail: 'The premium looks attractive precisely because the market expects movement. It is usually right.' },
      { lead: 'Holding through expiration week', detail: 'Squeezing the last of the credit is the highest-risk, lowest-reward part of the trade.' },
    ],
    calculator: 'iron-condor',
  },

  {
    id: 'pmcc',
    group: 'Income',
    name: "Poor Man's Covered Call",
    outlook: 'Bullish, income-oriented',
    capital: 'The net debit — a fraction of owning shares',
    glance: {
      risk: 'Defined',
      riskTone: 'good',
      direction: 'Bullish',
      volatility: 'Buy low IV',
      capital: 'Moderate',
      legs: '2',
    },
    summary:
      'Buy a deep in-the-money long-dated call and sell near-dated calls against it. The long call stands in for 100 shares at a fraction of the cost, so you run covered-call income without the capital. It is a diagonal spread wearing a different name, and it behaves like a covered call until the underlying moves far enough to expose the difference.',
    legs: [
      { action: 'buy', text: '1 deep ITM call, 6–12 months out — the share substitute' },
      { action: 'sell', text: '1 OTM call, 30–45 days out — the income leg, sold repeatedly' },
    ],
    keyFacts: [
      ['Max profit', 'Short strike − long strike − net debit, if both run to the long expiry', 'good'],
      ['Max loss', 'The net debit paid', 'bad'],
      ['Breakeven', 'Long strike + net debit, at the long expiry', null],
      ['Capital required', 'The net debit — typically 20–30% of buying the shares', null],
    ],
    entry: [
      { lead: 'Long call at 0.80 delta or deeper', detail: 'It has to behave like stock. A cheaper, lower-delta call moves too little against the short leg and the structure stops working.' },
      { lead: '6 – 12 months on the long leg', detail: 'Long enough that its time decay is slow while you sell several short cycles against it.' },
      { lead: 'Short strike above your total cost', detail: 'Long strike plus net debit. Selling below that caps the position at a loss, exactly as with a covered call below basis.' },
      { lead: 'Buy the long leg in low IV', detail: 'You are net long premium on the expensive leg. Overpaying for it is the most common way this ends up underwater.' },
    ],
    management: [
      { when: 'Entry', detail: 'Net debit paid. That is the whole risk, and it is far less than 100 shares would cost.' },
      { when: 'Short call cycle', detail: 'Close the short at ~50% and sell the next one. Each cycle reduces your net cost in the position.' },
      { when: 'Rally past the short', detail: 'Roll the short up and out for a credit. Assignment is awkward here — you would need to exercise the long or buy shares.' },
      { when: 'Sharp fall', detail: 'The long call loses value faster in percentage terms than shares would. There is no assignment fallback and no dividend to wait on.' },
      { when: 'Long leg ages', detail: 'Roll it out before decay accelerates, usually with 3+ months left. That costs a debit, so count it in the running cost.' },
    ],
    mistakes: [
      { lead: 'Long call not deep enough', detail: 'A 0.60 delta call is not a share substitute. It moves too little on rallies and too much on drops.' },
      { lead: 'Selling the short below total cost', detail: 'The same trap as a covered call under cost basis, and just as easy to walk into after the underlying has fallen.' },
      { lead: 'Forgetting the long leg decays too', detail: 'It is slower, not free. A flat underlying for six months still bleeds the position.' },
      { lead: 'Treating it as identical to a covered call', detail: 'No shares, no dividends, no assignment to fall back on, and a hard expiry on the whole position.' },
    ],
    calculator: 'pmcc',
  },

  {
    id: 'long-option',
    group: 'Directional',
    name: 'Long Calls & Puts',
    outlook: 'Strongly directional',
    capital: 'The premium paid',
    glance: {
      risk: 'Defined',
      riskTone: 'good',
      direction: 'Directional',
      volatility: 'Buy low IV',
      capital: 'Low',
      legs: '1',
    },
    summary:
      'Buy a call to profit from a rise, or a put to profit from a fall. The premium is the entire risk, and the upside on a call is unbounded. Every other strategy on this page is built from these two contracts, which makes them the place to start — and the hardest to make money with, because you pay for time decay every day you hold.',
    legs: [
      { action: 'buy', text: '1 call to be long the move up, or 1 put to be long the move down' },
    ],
    keyFacts: [
      ['Max profit', 'Call: unbounded. Put: strike − premium, if it goes to zero', 'good'],
      ['Max loss', 'The premium paid, in full', 'bad'],
      ['Breakeven', 'Call: strike + premium. Put: strike − premium', null],
      ['Capital required', 'The premium', null],
    ],
    entry: [
      { lead: 'You must be right on three things', detail: 'Direction, size of the move, and timing. A stock that rises after your expiry pays nothing, which is what makes these deceptively hard.' },
      { lead: 'Buy low IV', detail: 'An option bought when volatility is elevated can lose money on a correct call as IV contracts. Check IV rank before paying.' },
      { lead: 'Buy more time than feels necessary', detail: 'Decay accelerates in the last 30 days. Cheap weeklies are cheap because they usually expire worthless.' },
      { lead: 'Consider a spread instead', detail: 'With a price target, a debit spread costs less and breaks even sooner. Unbounded upside only matters if you truly expect a large move.' },
    ],
    management: [
      { when: 'Entry', detail: 'Premium paid. Maximum loss is fixed from here, which is this strategy’s one great virtue.' },
      { when: 'Every day held', detail: 'Time decay works against you and accelerates near expiry — the opposite of every premium-selling strategy here.' },
      { when: 'Thesis plays out', detail: 'Take profit. Holding a winning long option for more is how gains evaporate on one reversal.' },
      { when: '30 DTE', detail: 'Decay steepens sharply. Roll out or close rather than riding the steepest part of the curve.' },
    ],
    mistakes: [
      { lead: 'Buying weeklies for the leverage', detail: 'The cheapest options are cheapest because they almost always expire worthless. Leverage is not edge.' },
      { lead: 'Buying into an earnings IV spike', detail: 'You can be right on direction and still lose when volatility collapses after the announcement.' },
      { lead: 'Ignoring the breakeven', detail: 'A $100 call bought for $3 needs $103 to break even, not $100. The stock rising is not enough.' },
      { lead: 'Holding to expiry hoping', detail: 'An out-of-the-money option in its final days is a lottery ticket, not a position.' },
    ],
    calculator: 'long-option',
  },

  {
    id: 'iron-butterfly',
    group: 'Neutral',
    name: 'Iron Butterflies',
    outlook: 'Neutral — a bet on a pin',
    capital: 'Wing width less the credit',
    glance: {
      risk: 'Defined',
      riskTone: 'good',
      direction: 'Neutral',
      volatility: 'Sell high IV',
      capital: 'Low',
      legs: '4',
    },
    summary:
      'A condor with both short strikes at the same price. Sell a straddle at the money, then buy wings either side to cap the risk. It collects far more credit than a condor because the short strikes sit right where the stock is — and it needs the stock to finish much closer to that strike to keep it.',
    legs: [
      { action: 'buy', text: '1 put one wing width below — lower wing' },
      { action: 'sell', text: '1 put at the centre strike' },
      { action: 'sell', text: '1 call at the same centre strike' },
      { action: 'buy', text: '1 call one wing width above — upper wing' },
    ],
    keyFacts: [
      ['Max profit', 'The full credit, only if price pins the centre strike exactly', 'good'],
      ['Max loss', 'Wing width − credit', 'bad'],
      ['Breakevens', 'Centre − credit, and centre + credit', null],
      ['Capital required', 'The max loss', null],
    ],
    entry: [
      { lead: 'Centre where you expect it to land', detail: 'Usually at the money. The whole trade is a bet that the stock finishes near this one price.' },
      { lead: 'High IV, expected to fall', detail: 'You are selling a straddle at the core, so the position is heavily short volatility.' },
      { lead: 'Wings wide enough to be worth it', detail: 'Narrow wings cut the credit sharply; wide wings raise the max loss. That width is the whole risk/reward decision.' },
      { lead: 'Prefer a condor if unsure', detail: 'A condor gives a profit range instead of a profit point. A butterfly pays more for needing you to be more right.' },
    ],
    management: [
      { when: 'Entry', detail: 'Credit received, larger than a comparable condor because the shorts sit at the money.' },
      { when: '25 – 50% profit', detail: 'Take it earlier than a condor. The peak exists at one price only, and the stock rarely stays there.' },
      { when: 'Price drifts off centre', detail: 'The position deteriorates quickly. Roll the untested side in, or close, rather than waiting for a return.' },
      { when: '21 DTE', detail: 'Gamma risk is severe — the payoff is a peak, not a plateau, so small moves matter enormously near expiry.' },
    ],
    mistakes: [
      { lead: 'Expecting to collect max profit', detail: 'That needs the stock to close exactly at the centre strike. It essentially never happens.' },
      { lead: 'Treating it like a condor', detail: 'A condor has a profit plateau between two strikes. A butterfly has a single peak, and everything either side of it is worse.' },
      { lead: 'Wings too narrow', detail: 'It looks like less risk, but it guts the credit and leaves a trade that cannot pay for its own losses.' },
      { lead: 'Holding through expiry week', detail: 'The peak is sharpest and the gamma worst exactly when the temptation to hold is greatest.' },
    ],
    calculator: 'iron-butterfly',
  },

  {
    id: 'strangle',
    group: 'Volatility',
    name: 'Strangles & Straddles',
    outlook: 'A view on movement, not direction',
    capital: 'Short: heavy margin. Long: the premium',
    glance: {
      risk: 'Short: undefined',
      riskTone: 'bad',
      direction: 'Non-directional',
      volatility: 'Short: sell high IV',
      capital: 'Short: high',
      legs: '2',
    },
    summary:
      'Sell — or buy — both a put and a call on the same underlying. Same strike makes it a straddle; different strikes a strangle. Short versions collect double premium and profit when the stock goes nowhere, with genuinely unbounded risk on the call side. Long versions pay double premium betting the stock moves sharply, and are the standard way to trade an earnings event.',
    legs: [
      { action: 'sell', text: '1 put below the price — buy it instead for the long version' },
      { action: 'sell', text: '1 call above the price — buy it instead for the long version' },
    ],
    keyFacts: [
      ['Max profit', 'Short: the total premium. Long: unbounded on the call side', 'good'],
      ['Max loss', 'Short: unbounded. Long: the premium paid', 'bad'],
      ['Breakevens', 'Put strike − premium, and call strike + premium', null],
      ['Capital required', 'Short: substantial naked margin. Long: the premium', null],
    ],
    entry: [
      { lead: 'Short strangles need real capital', detail: 'This is naked on both sides. Brokers demand heavy margin, and they are right to — the call side has no ceiling.' },
      { lead: 'Sell into high IV, buy into low', detail: 'The short version wants volatility to fall after entry; the long version wants it to rise, or the stock to move hard.' },
      { lead: 'Long straddles for events', detail: 'Earnings, rulings, data. But IV is already elevated going in, so the move has to beat what is priced, not merely happen.' },
      { lead: 'Consider a condor instead', detail: 'A short strangle with wings bought is an iron condor. You give up credit and cap the risk — usually the better trade.' },
    ],
    management: [
      { when: 'Entry', detail: 'Short: both premiums received, margin held. Long: both premiums paid, and that is the whole risk.' },
      { when: '50% profit (short)', detail: 'Close. Undefined risk is not something to hold for the last of the credit.' },
      { when: 'One side tested (short)', detail: 'Roll the tested side out, or close the position. Do not add to it hoping for reversion.' },
      { when: 'After the event (long)', detail: 'Close quickly. Volatility crush after earnings can wipe out a long straddle even when the stock moved your way.' },
    ],
    mistakes: [
      { lead: 'Selling naked without the capital behind it', detail: 'A short call has unbounded loss. A gap up on takeover news is the scenario that ends accounts, and no stop protects you overnight.' },
      { lead: 'Buying straddles into earnings without checking IV', detail: 'The move is already priced. A large move that merely matches expectations still loses to the volatility crush.' },
      { lead: 'Treating a short strangle as a condor', detail: 'They look alike in the middle of a payoff diagram and are nothing alike in the tails, which is where it matters.' },
      { lead: 'Holding short premium through binary events', detail: 'Earnings, FDA decisions, court rulings — exactly when an unbounded-risk position is most exposed.' },
    ],
    calculator: 'strangle',
  },

  {
    id: 'protective-put',
    group: 'Protection',
    name: 'Protective Puts & Collars',
    outlook: 'Long shares, wanting a floor',
    capital: 'The put premium, or near zero for a collar',
    glance: {
      risk: 'Defined',
      riskTone: 'good',
      direction: 'Long shares',
      volatility: 'Buy low IV',
      capital: 'Low',
      legs: '1 – 2 vs shares',
    },
    summary:
      'Own the shares and buy a put beneath them and you have a floor: the stock can fall no further than the strike, whatever happens. That insurance costs premium. Sell a call above the shares to pay for it and you have a collar — a floor and a ceiling, often for close to nothing. This is the answer to a wheel position that has gone wrong, and the reason to hold rather than panic.',
    legs: [
      { action: 'hold', text: '100 shares per contract — assigned, or bought outright' },
      { action: 'buy', text: '1 put below the price — the floor' },
      { action: 'sell', text: '1 call above the price — pays for the floor, adds a ceiling (collar only)' },
    ],
    keyFacts: [
      ['Max profit', 'Protective put: unbounded. Collar: capped at the call strike', 'good'],
      ['Max loss', 'Basis − put strike + net cost. Fixed, whatever the stock does', 'bad'],
      ['Breakeven', 'Cost basis + net cost of the hedge', null],
      ['Capital required', 'The put premium, less any call credit', null],
    ],
    entry: [
      { lead: 'Choose the floor you can live with', detail: 'A closer put costs more and protects sooner. A further put is cheap insurance against catastrophe only.' },
      { lead: 'Buy protection before you need it', detail: 'Put premium spikes exactly when the market falls. Hedging after a drop means paying the panic price.' },
      { lead: 'Collar when protection feels expensive', detail: 'Selling a call above pays for the put. A zero-cost collar is often achievable, and what it costs is upside.' },
      { lead: 'Set the call above your basis', detail: 'Same rule as a covered call. A collar with the call under your basis locks in a loss at both ends.' },
    ],
    management: [
      { when: 'Entry', detail: 'Shares held, put bought. Downside is bounded from here no matter what happens.' },
      { when: 'Stock falls', detail: 'The put gains as the shares lose. This is the hedge working, not a separate position to manage.' },
      { when: 'Stock rallies (collar)', detail: 'The short call caps you. Buying it back to reclaim the upside is the cost of having been protected.' },
      { when: 'Put nears expiry', detail: 'Roll it out if the reason for the hedge still stands. Insurance lapses.' },
    ],
    mistakes: [
      { lead: 'Hedging after the fall', detail: 'Put premium is most expensive precisely when fear is highest. Protection bought in a panic rarely pays.' },
      { lead: 'Collaring below cost basis', detail: 'A call under your basis means being called away at a loss, with the floor guaranteeing you eat it.' },
      { lead: 'Paying for protection you never use', detail: 'Continuously buying puts on a position you would hold anyway is a slow, permanent drag on returns.' },
      { lead: 'Forgetting the ceiling exists', detail: 'A collar caps the upside. On a name that runs, the capped gain can hurt more than the drawdown you insured against.' },
    ],
    calculator: 'protective-put',
  },

  {
    id: 'jade-lizard',
    group: 'Income',
    name: 'Jade Lizard',
    outlook: 'Neutral to bullish',
    capital: 'Put collateral, plus the call spread width',
    glance: {
      risk: 'Undefined below',
      riskTone: 'bad',
      direction: 'Neutral / bullish',
      volatility: 'Sell high IV',
      capital: 'High',
      legs: '3',
    },
    summary:
      'A short put plus a short call spread. Size the total credit above the width of the call spread and the position has no upside risk at all — the stock can gap to any price and you still keep something. The downside behaves exactly like a cash-secured put, which is the trade you were making anyway.',
    legs: [
      { action: 'sell', text: '1 put below the price — the same short put as a wheel entry' },
      { action: 'sell', text: '1 call above the price' },
      { action: 'buy', text: '1 further call — caps the upside side' },
    ],
    keyFacts: [
      ['Max profit', 'The total credit, if price finishes between the put and short call', 'good'],
      ['Upside risk', 'Call spread width − credit. Zero if the credit exceeds the width', null],
      ['Downside risk', 'Put strike − credit, per share, to zero', 'bad'],
      ['Capital required', 'Put collateral plus the call spread margin', null],
    ],
    entry: [
      { lead: 'Credit above the call spread width', detail: 'This is the defining condition. Collect $5.00 against a $5 wide call spread and no price above the calls can hurt you.' },
      { lead: 'Put strike where you would buy', detail: 'The downside is a cash-secured put with extra credit. All the wheel entry rules still apply.' },
      { lead: 'High IV, both sides', detail: 'You are selling three options. Elevated volatility is what makes the credit large enough to cover the call width.' },
      { lead: '30 – 45 days out', detail: 'The usual short-premium window.' },
    ],
    management: [
      { when: 'Entry', detail: 'Credit received across three legs. Upside is either capped or eliminated depending on the credit.' },
      { when: '50% profit', detail: 'Close as with any short-premium position.' },
      { when: 'Stock rallies', detail: 'If the credit covered the width, do nothing — a rally cannot hurt. That is the point of the structure.' },
      { when: 'Stock falls', detail: 'Manage exactly like a cash-secured put: roll down and out for a credit, or accept assignment.' },
    ],
    mistakes: [
      { lead: 'Not actually covering the call width', detail: 'A jade lizard whose credit is below the call spread width is just a short put with a capped, risky call side. Check the arithmetic before entering.' },
      { lead: 'Forgetting the downside is undefined', detail: 'The headline is "no upside risk". The put side is still a full cash-secured put and that is where the real exposure lives.' },
      { lead: 'Chasing the structure on a bad name', detail: 'The put strike still means you might own the shares. Same rule as always.' },
    ],
    calculator: 'jade-lizard',
  },

  {
    id: 'covered-strangle',
    group: 'Income',
    name: 'Covered Strangle',
    outlook: 'Bullish, willing to double',
    capital: 'The shares plus full put collateral',
    glance: {
      risk: 'Undefined',
      riskTone: 'bad',
      direction: 'Bullish',
      volatility: 'Sell high IV',
      capital: 'Very high',
      legs: '3',
    },
    summary:
      'Own 100 shares, sell a covered call above and a cash-secured put below. Two premiums instead of one, on a name you already hold. The catch is in the name: if the stock falls through the put you are assigned a second hundred shares, so you must want twice as much of it as you already own.',
    legs: [
      { action: 'hold', text: '100 shares per contract' },
      { action: 'sell', text: '1 call above the price — caps the shares you hold' },
      { action: 'sell', text: '1 put below the price — commits you to buying 100 more' },
    ],
    keyFacts: [
      ['Max profit', 'Call strike − basis, plus both premiums', 'good'],
      ['Max loss', 'Both lots to zero, less the premiums collected', 'bad'],
      ['Breakeven', 'Cost basis − total premium (before assignment)', null],
      ['Capital required', 'The shares you hold plus full collateral for the put', null],
    ],
    entry: [
      { lead: 'Only if you want twice the position', detail: 'This is the whole risk. Assignment doubles your exposure to one name at exactly the moment it is falling.' },
      { lead: 'Put strike where you would add', detail: 'Treat it as a limit order you get paid for, at a level where doubling up is genuinely attractive.' },
      { lead: 'Call above your cost basis', detail: 'Same rule as any covered call. A call below basis locks in a loss when called away.' },
      { lead: 'Size for the doubled position', detail: 'Half the position size you would normally take, because assignment makes it the full one.' },
    ],
    management: [
      { when: 'Entry', detail: 'Two premiums received. Capital committed on both the shares and the put collateral.' },
      { when: 'Stock rises', detail: 'The call caps you. Roll it up and out for a credit if you want to keep the shares.' },
      { when: 'Stock falls to the put', detail: 'Assignment doubles the position at a lower basis. The blended basis is what matters from here.' },
      { when: 'After assignment', detail: 'You now hold 200 shares. Sell covered calls against both lots — above the blended basis, not the original.' },
    ],
    mistakes: [
      { lead: 'Running it on a full-size position', detail: 'Assignment turns a normal position into a double. Sizing for the pre-assignment state is how concentration accidents happen.' },
      { lead: 'Using the original basis after assignment', detail: 'The blended basis is lower. Calls priced off the old number leave money on the table or lock in losses.' },
      { lead: 'Treating it as safer than a covered call', detail: 'It collects more premium because it carries more risk. The put side is a genuine second commitment.' },
    ],
    calculator: 'covered-strangle',
  },

  {
    id: 'broken-wing',
    group: 'Neutral',
    name: 'Broken Wing Butterfly',
    outlook: 'Neutral with a directional lean',
    capital: 'Wing difference less the credit',
    glance: {
      risk: 'Defined',
      riskTone: 'good',
      direction: 'Leaning',
      volatility: 'Sell high IV',
      capital: 'Low',
      legs: '4',
    },
    summary:
      'A butterfly with one wing further out than the other. Skewing it that way usually lets you put the trade on for a credit, which means the narrow side finishes risk-free — if the stock runs that way you simply keep the credit. All the risk sits on the wide side, which is the direction you believe it will not go.',
    legs: [
      { action: 'buy', text: '1 option one narrow wing beyond the body' },
      { action: 'sell', text: '2 options at the body strike — the peak' },
      { action: 'buy', text: '1 option one wide wing the other side — where the risk lives' },
    ],
    keyFacts: [
      ['Max profit', 'Narrow wing + credit, at the body strike', 'good'],
      ['Max loss', 'Wide wing − narrow wing − credit', 'bad'],
      ['Risk-free side', 'The narrow side, whenever the trade is opened for a credit', null],
      ['Capital required', 'The max loss', null],
    ],
    entry: [
      { lead: 'Open it for a credit', detail: 'This is the point. A credit means the narrow side cannot lose, so you are only wrong in one direction.' },
      { lead: 'Wide wing away from your fear', detail: 'All the risk sits on the wide side. Put it where you least expect the stock to go.' },
      { lead: 'Body where you expect it to land', detail: 'The peak is at the body strike, exactly as with a symmetric butterfly.' },
      { lead: 'Sell into high IV', detail: 'You are net short premium, so richer options mean a larger credit and a wider risk-free zone.' },
    ],
    management: [
      { when: 'Entry', detail: 'Credit received. The narrow side is already safe.' },
      { when: 'Drifts to the narrow side', detail: 'Nothing to do — that side pays the credit and nothing more. Let it go.' },
      { when: 'Drifts to the wide side', detail: 'This is the only place you lose. Close or roll before it reaches the far wing.' },
      { when: '21 DTE', detail: 'Same gamma warning as any butterfly: the peak sharpens and small moves matter a lot.' },
    ],
    mistakes: [
      { lead: 'Putting it on for a debit', detail: 'That surrenders the risk-free side, which is the entire reason to break the wing in the first place.' },
      { lead: 'Wide wing in the wrong direction', detail: 'Placing the risk where the stock is actually likely to move turns a clever structure into a bad directional bet.' },
      { lead: 'Expecting the peak', detail: 'Like every butterfly, the maximum only exists at one price. Plan for the plateau, not the point.' },
    ],
    calculator: 'broken-wing',
  },

  {
    id: 'vol-risk-premium',
    group: 'Hedge Fund',
    name: 'Volatility Risk Premium',
    outlook: 'The edge behind every premium sale',
    capital: 'Whatever the structure requires',
    glance: {
      risk: 'Varies',
      direction: 'Non-directional',
      volatility: 'Sell it',
      capital: 'Varies',
      legs: 'An approach',
    },
    summary:
      'Implied volatility tends to exceed the volatility that subsequently arrives. That gap is the volatility risk premium, and it is the reason selling options is profitable on average rather than a coin flip. Every income strategy on this page — the wheel, credit spreads, condors — is a different way of harvesting the same edge. Understanding it tells you when the edge is present and when it is not.',
    legs: [
      { action: 'sell', text: 'Any short-premium structure — this is an approach, not a position' },
    ],
    keyFacts: [
      ['The edge', 'Implied vol exceeds realised vol most of the time, on most underlyings', 'good'],
      ['Why it exists', 'Investors pay up for protection. That demand is structural, not a mistake', null],
      ['When it fails', 'Crashes. The premium is compensation for taking the tail, and sometimes the tail arrives', 'bad'],
      ['How to measure it', 'Compare current IV against the realised volatility of recent weeks', null],
    ],
    entry: [
      { lead: 'Sell when IV rank is high', detail: 'The premium is largest when implied volatility is elevated relative to its own history. That is when the gap is widest.' },
      { lead: 'Not all underlyings are equal', detail: 'Broad indices carry a persistent premium because they are what people hedge with. Single names are noisier and the edge is thinner.' },
      { lead: 'Diversify across time, not just names', detail: 'Staggered expiries mean a single bad week cannot catch every position at its worst moment.' },
      { lead: 'Assume the tail will arrive', detail: 'The premium exists because sellers occasionally lose badly. Size on the assumption that it happens to you eventually.' },
    ],
    management: [
      { when: 'Normal conditions', detail: 'The edge accrues slowly and unspectacularly. Most months look like nothing happening.' },
      { when: 'Volatility spike', detail: 'Positions lose together — this is the correlation nobody prices in. Reduce rather than double down.' },
      { when: 'After a crash', detail: 'IV is highest exactly when selling feels worst. That is usually when the premium is most real.' },
      { when: 'Long run', detail: 'Judge the approach over years, not trades. A single quarter says almost nothing about whether the edge is working.' },
    ],
    mistakes: [
      { lead: 'Mistaking the premium for free money', detail: 'It is payment for accepting losses that are rare, correlated, and large. Long strings of wins are the strategy working normally, not evidence of safety.' },
      { lead: 'Selling into low IV', detail: 'When implied volatility is already low there is little premium to harvest and the same tail risk to carry.' },
      { lead: 'Sizing off the win rate', detail: 'A 90% win rate says nothing about expectancy if the 10% is ten times larger.' },
      { lead: 'Ignoring correlation', detail: 'Twenty positions across twenty names is one position when the market falls.' },
    ],
    calculator: null,
  },

  {
    id: 'tail-hedge',
    group: 'Hedge Fund',
    name: 'Tail Risk Hedging',
    outlook: 'Insurance against the crash',
    capital: 'A small, continuous bleed',
    glance: {
      risk: 'Defined',
      riskTone: 'good',
      direction: 'Short crash',
      volatility: 'Buy low IV',
      capital: 'Low',
      legs: '1, repeatedly',
    },
    summary:
      'Continuously buy far out-of-the-money puts on an index. Most expire worthless and the programme costs one or two percent a year. In a genuine crash the payoff is convex and enormous — the position that was bleeding quietly becomes the one that saves the portfolio. It is the deliberate mirror image of premium selling, and the two coexist well.',
    legs: [
      { action: 'buy', text: 'Far OTM index puts, 15–30% below spot, rolled continuously' },
    ],
    keyFacts: [
      ['Cost', 'Typically 1 – 2% of portfolio value per year, paid continuously', 'bad'],
      ['Payoff', 'Convex — it accelerates as the drawdown deepens', 'good'],
      ['Max loss', 'The premium spent. It is an expense, not a position', null],
      ['When it works', 'Fast, deep, correlated drawdowns. Not slow grinding declines', null],
    ],
    entry: [
      { lead: '15 – 30% out of the money', detail: 'Close enough to pay in a real crash, far enough that the premium stays small. Nearer puts cost more than the protection is worth.' },
      { lead: 'Buy when volatility is cheap', detail: 'Insurance bought calmly is affordable. Bought in a panic it is not, and that is exactly when people reach for it.' },
      { lead: 'Roll continuously', detail: 'The programme only works if it is always on. A hedge you let lapse protects nothing, and gaps do not announce themselves.' },
      { lead: 'Size as an expense line', detail: 'Decide what percentage of the portfolio per year you will spend, then buy what that affords. Do not size off what you hope to make.' },
    ],
    management: [
      { when: 'Most of the time', detail: 'It loses money. Every month. That is the programme working correctly, and it is the reason most people abandon it.' },
      { when: 'Volatility rises', detail: 'The puts gain on volatility alone, before the underlying reaches them.' },
      { when: 'Real crash', detail: 'Payoff is convex. Consider monetising rather than holding for more — the peak is brief and the rebound is fast.' },
      { when: 'After monetising', detail: 'Re-establish once volatility subsides. Crashes cluster, and the second leg is a real risk.' },
    ],
    mistakes: [
      { lead: 'Abandoning it after a quiet year', detail: 'The whole payoff is in the rare event. Cancelling insurance because you did not claim is how you are uninsured for the one that matters.' },
      { lead: 'Buying after the fall', detail: 'Put premium spikes with fear. The hedge is cheapest precisely when nobody wants it.' },
      { lead: 'Strikes too close', detail: 'Nearer puts feel safer but cost several times more, turning a 1% annual bleed into a 5% one the portfolio cannot carry.' },
      { lead: 'Treating it as a trade', detail: 'It is an expense line with a lottery ticket attached. Judging it on monthly P&L guarantees you cancel it at the worst moment.' },
    ],
    calculator: 'tail-hedge',
  },

  {
    id: 'risk-reversal',
    group: 'Hedge Fund',
    name: 'Skew & Risk Reversals',
    outlook: 'Bullish, funded by selling fear',
    capital: 'Put collateral, or margin',
    glance: {
      risk: 'Undefined',
      riskTone: 'bad',
      direction: 'Bullish',
      volatility: 'Sell put skew',
      capital: 'High',
      legs: '2',
    },
    summary:
      'Out-of-the-money puts are structurally more expensive than equidistant calls, because everyone wants downside protection and few want upside. That asymmetry is the volatility skew. A risk reversal sells the expensive put to buy the cheap call — often for zero cost or a credit — leaving you long the underlying with a shape the market has paid you to take.',
    legs: [
      { action: 'sell', text: '1 OTM put — the expensive side of the skew' },
      { action: 'buy', text: '1 OTM call — the cheap side, funded by the put' },
    ],
    keyFacts: [
      ['Max profit', 'Unbounded above the call strike', 'good'],
      ['Max loss', 'Put strike less the net credit, to zero. Same as a short put', 'bad'],
      ['Cost', 'Often near zero, sometimes a credit — that is the skew paying you', null],
      ['Capital required', 'Full put collateral if secured, otherwise naked margin', null],
    ],
    entry: [
      { lead: 'Check the skew is actually there', detail: 'Compare the IV of the put and the call you are trading. If they are similar, there is no premium to harvest and this is just a leveraged bet.' },
      { lead: 'Only where you would own the shares', detail: 'The short put is a real commitment. Every cash-secured put rule applies unchanged.' },
      { lead: 'Steep skew, calm market', detail: 'Skew steepens after selloffs. That is when the put is richest relative to the call.' },
      { lead: 'Know it is a synthetic long', detail: 'The combined position behaves much like owning the stock, with a gap between the strikes where nothing happens.' },
    ],
    management: [
      { when: 'Entry', detail: 'Near-zero cost, sometimes a credit. Delta is positive and grows as the stock rises.' },
      { when: 'Stock rises', detail: 'The call gains, the put decays. Both legs work together — this is the intended outcome.' },
      { when: 'Stock falls', detail: 'The short put dominates and the call becomes worthless. Manage it exactly like a cash-secured put.' },
      { when: 'Skew flattens', detail: 'Part of the edge was the skew itself. If it normalises while price is unchanged, the position has gained a little.' },
    ],
    mistakes: [
      { lead: 'Treating "zero cost" as zero risk', detail: 'It costs nothing to put on and can lose as much as owning the shares outright. Cost and risk are unrelated here.' },
      { lead: 'Trading it without checking skew', detail: 'Without a genuine IV difference between the legs, there is no edge, only leverage.' },
      { lead: 'Using naked margin carelessly', detail: 'Brokers permit far more size than is prudent. The put should be one you could actually honour.' },
    ],
    calculator: 'risk-reversal',
  },

  {
    id: 'buffer',
    group: 'Hedge Fund',
    name: 'Defined Outcome & Buffers',
    outlook: 'Long, with a floor and a ceiling',
    capital: 'The underlying exposure',
    glance: {
      risk: 'Defined',
      riskTone: 'good',
      direction: 'Long',
      volatility: 'Structure dependent',
      capital: 'Moderate',
      legs: '3 – 4',
    },
    summary:
      'A structure that absorbs the first slice of a fall in exchange for capping the gain, over a fixed period. This is what buffer ETFs sell, and it is a multi-billion-dollar product category built entirely from a collar. Knowing the construction means you can build it yourself on a position you already hold, choose your own buffer and cap, and skip the management fee.',
    legs: [
      { action: 'buy', text: '1 deep ITM call — the long exposure, cheaper than shares' },
      { action: 'buy', text: '1 ATM put — the top of the buffer' },
      { action: 'sell', text: '1 OTM put — the bottom of the buffer, funds the structure' },
      { action: 'sell', text: '1 OTM call — the cap, pays for the rest' },
    ],
    keyFacts: [
      ['Buffer', 'The first slice of a fall, absorbed entirely', 'good'],
      ['Cap', 'The most you can make over the period, whatever the underlying does', null],
      ['Below the buffer', 'Losses resume one for one — it is a buffer, not a floor', 'bad'],
      ['Outcome period', 'Fixed. The buffer and cap only hold if held to the end', null],
    ],
    entry: [
      { lead: 'Match the period to the legs', detail: 'The buffer and cap only apply at expiry. Entering mid-period or exiting early gives neither.' },
      { lead: 'Deeper buffers cost more cap', detail: 'The trade-off is explicit. A 15% buffer costs more upside than a 9% one, always.' },
      { lead: 'Best when you want exposure but fear a drawdown', detail: 'It is for holding through uncertainty, not for maximising return.' },
      { lead: 'Build it yourself on a position you hold', detail: 'You already have the shares. A collar plus a put spread reproduces the product without the fee.' },
    ],
    management: [
      { when: 'Entry', detail: 'All legs on. The outcome profile is fixed for the period from here.' },
      { when: 'Mid-period', detail: 'The value will not track the advertised buffer or cap. Those apply at expiry only, and interim marks can look alarming.' },
      { when: 'Underlying falls inside the buffer', detail: 'The structure absorbs it. This is the whole reason to hold it.' },
      { when: 'Underlying falls past the buffer', detail: 'Losses resume one for one from there. A buffer is not a floor and never was.' },
      { when: 'Period ends', detail: 'Roll into the next one if the reason still stands, at whatever buffer and cap the market then offers.' },
    ],
    mistakes: [
      { lead: 'Believing the buffer is a floor', detail: 'It absorbs the first slice. Past it you lose exactly as though it were not there.' },
      { lead: 'Judging it mid-period', detail: 'The legs price independently before expiry. Mid-period marks routinely look worse than the outcome profile implies.' },
      { lead: 'Ignoring the cap in a strong year', detail: 'It was the price of the buffer. Regretting it in a rally is regretting the trade you chose to make.' },
      { lead: 'Paying a fund for it', detail: 'The construction is four legs you can place yourself if you already hold the underlying.' },
    ],
    calculator: 'buffer',
  },

  {
    id: 'ratio-spread',
    group: 'Directional',
    name: 'Ratio Spreads & Backspreads',
    outlook: 'Directional, with a tail',
    capital: 'Margin for the extra naked leg',
    glance: {
      risk: 'Undefined one side',
      riskTone: 'bad',
      direction: 'Directional',
      volatility: 'Front: sell high IV',
      capital: 'Moderate',
      legs: '3 contracts, 2 strikes',
    },
    summary:
      'One leg against two. A front ratio buys one option and sells two further out, usually for a credit — it pays best if the underlying drifts to the short strike and stops there, and it loses without limit if it keeps going. A backspread reverses it: sell one, buy two, often still for a credit, so you are paid to hold a position that explodes in your favour on a large move. Same two strikes, opposite personalities.',
    legs: [
      { action: 'buy', text: '1 option nearer the money — the anchor leg' },
      { action: 'sell', text: '2 options further out — the ratio, and the exposure' },
      { action: 'hold', text: 'Reverse both for a backspread: sell 1 near, buy 2 far' },
    ],
    keyFacts: [
      ['Front ratio max profit', 'Strike width + credit, at the far strike exactly', 'good'],
      ['Front ratio max loss', 'Unbounded past the far strike — one leg is naked', 'bad'],
      ['Backspread max profit', 'Unbounded past the far strike', 'good'],
      ['Backspread max loss', 'Strike width − credit, at the far strike', 'bad'],
    ],
    entry: [
      { lead: 'Know which one you are placing', detail: 'Front ratio and backspread use identical strikes and have opposite risk. Confusing them is the fastest way to be short the tail you meant to be long.' },
      { lead: 'Take a credit if you can', detail: 'A front ratio for a credit cannot lose on the near side. A backspread for a credit pays you to wait for the move.' },
      { lead: 'Front ratios need a target', detail: 'They pay most if the underlying finishes at the far strike. Place that strike where you expect it to stall, not where you hope it goes.' },
      { lead: 'Backspreads want cheap options', detail: 'You are net long a contract. Low IV makes the two long legs affordable relative to the one you sell.' },
      { lead: 'Check the margin before entering', detail: 'The uncovered leg is margined as naked. Brokers can require far more than the credit suggests.' },
    ],
    management: [
      { when: 'Entry', detail: 'Credit received either way, but the risk sits at opposite ends of the chart.' },
      { when: 'Front: drifting toward the far strike', detail: 'This is the good case, and it is also when to start thinking about closing. The peak is a point, not a plateau.' },
      { when: 'Front: through the far strike', detail: 'The naked leg takes over and losses run one for one. Close or add the missing wing — do not wait.' },
      { when: 'Back: sitting at the far strike', detail: 'The worst place to be at expiry. If the move has not happened, close before gamma turns the trough into the realised outcome.' },
      { when: '21 DTE', detail: 'Both structures have a sharp point at the far strike, so gamma near expiry matters more here than in a plain spread.' },
    ],
    mistakes: [
      { lead: 'Not counting the naked leg', detail: 'A 1x2 has one uncovered contract. That is a naked short with everything that implies, whatever the net credit looks like.' },
      { lead: 'Treating a front ratio as a spread', detail: 'It looks like a debit spread with extra credit until the underlying goes through the far strike. It is not — the loss does not stop.' },
      { lead: 'Holding a backspread to expiry', detail: 'The maximum loss sits exactly at the far strike, and that is where price often pins. Close before it settles there.' },
      { lead: 'Adding ratios on top of short premium', detail: 'They stack the same directional exposure. A portfolio of front ratios is one large naked position wearing several names.' },
    ],
    calculator: 'ratio-spread',
  },

  {
    id: 'gamma',
    group: 'Concepts',
    name: 'Gamma',
    outlook: 'Why short premium goes wrong quickly',
    capital: 'Not a position',
    glance: {
      risk: 'The accelerator',
      direction: 'Either',
      volatility: 'Rises near expiry',
      capital: 'n/a',
      legs: 'A concept',
    },
    summary:
      'Delta tells you how much an option moves when the underlying moves. Gamma tells you how fast that delta itself changes. It is the reason a short position that looked comfortable on Monday is a disaster by Thursday, and it is the single mechanism behind almost every management rule on this page — close at 50%, manage at 21 DTE, do not hold through expiry week. Those are not superstitions. They are all gamma avoidance.',
    legs: [
      { action: 'buy', text: 'Long options are long gamma — the position helps itself as it moves' },
      { action: 'sell', text: 'Short options are short gamma — the position hurts itself as it moves' },
    ],
    keyFacts: [
      ['What it is', 'The rate at which delta changes as the underlying moves', null],
      ['Long gamma', 'Delta grows in your favour. You get longer into rallies, shorter into falls', 'good'],
      ['Short gamma', 'Delta grows against you. You get shorter into falls, longer into rallies', 'bad'],
      ['Where it peaks', 'At the money, and increasingly as expiry approaches', null],
    ],
    entry: [
      { lead: 'Every premium sale is short gamma', detail: 'The wheel, credit spreads, condors, strangles. Collecting theta means carrying gamma. They are the same trade seen from two sides.' },
      { lead: 'Gamma is why 30 – 45 DTE', detail: 'Far enough out that gamma is mild, near enough that decay is meaningful. The whole window is a compromise between the two.' },
      { lead: 'At-the-money is where it lives', detail: 'A far out-of-the-money short has little gamma. The same strike becomes dangerous as price approaches it, not just because it might be assigned.' },
      { lead: 'Size for the gamma, not the delta', detail: 'A position sized comfortably at 45 DTE can be several times as sensitive at 7 DTE without you doing anything.' },
    ],
    management: [
      { when: '45 DTE', detail: 'Gamma is low. The position barely reacts to a normal day and there is little to manage.' },
      { when: '21 DTE', detail: 'Gamma starts climbing sharply. This is the origin of the manage-at-21 rule — not the calendar, the curvature.' },
      { when: 'Expiry week', detail: 'Gamma is at its most violent. A short strike a dollar away can go from safe to full loss inside a session.' },
      { when: 'Expiry day (0DTE)', detail: 'Almost pure gamma. Theta collected is tiny, the gamma is enormous, and the position is effectively a coin flip with leverage.' },
      { when: 'At the strike, at expiry', detail: 'Pin risk. You may not know until after the close whether you were assigned, and you carry the weekend gap either way.' },
    ],
    mistakes: [
      { lead: 'Reading the win rate instead of the gamma', detail: 'A short strike that has been safe for six weeks is at its most dangerous in the last one. The record so far says nothing about the days that remain.' },
      { lead: 'Holding to expiry for the last of the credit', detail: 'You collect the smallest part of the premium during the period of greatest risk. That trade is backwards.' },
      { lead: 'Selling 0DTE for the theta', detail: 'There is barely any theta left to collect. What you are actually being paid for is the gamma, and the payment is small.' },
      { lead: 'Assuming a hedge holds', detail: 'Under high gamma a delta hedge goes stale in minutes. A position hedged this morning is not hedged this afternoon.' },
    ],
    extraSections: [
      {
        title: 'Long gamma vs short gamma',
        body: [
          'Long gamma means the position gets more right the more it moves. Buy a call, the stock rallies, and your delta grows — you are longer at exactly the moment you want to be. Fall instead, and the delta shrinks, so you lose less than a share position would.',
          'Short gamma is the mirror, and it is unpleasant. Sell a put, the stock falls, and your delta grows long — you become more exposed the further it goes against you. Rally instead, and the delta fades, so you participate less than you would like.',
          'That asymmetry is what you are paid for. Theta is the rent collected for standing on the wrong side of curvature.',
          'It also explains why losses cluster. Every short-premium position in the account is short gamma at once, so they all deteriorate together in a fast move. The diversification you thought you had across names does not exist across gamma.',
        ],
      },
      {
        title: 'Why gamma explodes near expiry',
        body: [
          'Far from expiry, an option has time value that changes smoothly. A dollar in the underlying barely alters the probability of finishing in the money, so delta moves slowly and gamma is small.',
          'On the final day, that probability is nearly a step function. A strike a cent out of the money is worthless; a cent in the money is worth its full intrinsic. Delta must swing from near zero to near one over a tiny price range, and gamma is that swing.',
          'This is why a short strike sitting comfortably out of the money at 30 days can be a full loss at 2 days on the same size of move. Nothing about your position changed. The curvature did.',
          'It is also why the two most common rules exist. Closing at 50% of max profit takes the money while gamma is still mild; managing at 21 DTE exits before the curve steepens. Both trade a little profit for a lot less risk.',
        ],
      },
      {
        title: 'Gamma scalping, and why funds do it',
        body: [
          'If short gamma is a cost, long gamma is an asset — one you can actively harvest. Buy options, then continuously trade the underlying against your changing delta: sell shares as the position gets longer, buy them back as it gets shorter.',
          'Every one of those trades locks in a small profit, bought and sold at prices your own convexity handed you. Do it enough and you have monetised movement itself.',
          'The trade wins when realised volatility exceeds the implied volatility you paid, and loses when it does not — the position bleeds theta the whole time. It is the volatility risk premium run in reverse, deliberately.',
          'Retail can do this in principle. In practice it needs near-continuous hedging, and commissions and spreads on all that share trading usually eat the edge before you see it. Worth understanding as the other side of what you do, rather than as something to run.',
        ],
      },
    ],
    calculator: null,
  },

  {
    id: 'hedging',
    group: 'Hedge Fund',
    name: 'Hedging',
    outlook: 'Reducing what a bad market does to you',
    capital: 'A cost, not a position',
    glance: {
      risk: 'Reduces',
      riskTone: 'good',
      direction: 'Defensive',
      volatility: 'Buy low IV',
      capital: 'Ongoing cost',
      legs: 'Many forms',
    },
    summary:
      'Hedging is paying something now so a bad market costs you less later. Funds do it because they must stay invested and their clients redeem after drawdowns. You have neither constraint, which changes the answer more than most writing on the subject admits. This page covers what the instruments are, what each actually costs, where each fails — and the honest case that a small account is usually better off sizing smaller than hedging at all.',
    legs: [
      { action: 'buy', text: 'Index puts — the direct hedge, priced accordingly' },
      { action: 'sell', text: 'Index futures or shares — linear, cheap, gives up the upside too' },
      { action: 'hold', text: 'Cash — the only hedge with no cost, no basis risk and no expiry' },
    ],
    keyFacts: [
      ['Typical cost', 'Continuous put buying runs 1 – 2% of portfolio value per year', 'bad'],
      ['Linear vs convex', 'Shorts offset one for one. Puts cost more but pay accelerating in a crash', null],
      ['Basis risk', 'Your book is not the index. A perfect index hedge still leaves single-name risk', 'bad'],
      ['The free alternative', 'Holding less. Same effect on drawdown, no cost, no basis risk', 'good'],
    ],
    entry: [
      { lead: 'Decide what you are hedging against', detail: 'A crash, a grinding decline, and one position going wrong need completely different instruments. Most failed hedges are the right tool for the wrong risk.' },
      { lead: 'Hedge the beta, not the dollars', detail: 'A book that moves 1.2x the index needs 1.2x its value hedged to be neutral. Hedging the dollar value leaves a fifth of the exposure standing.' },
      { lead: 'Buy protection when it is cheap', detail: 'Put premium spikes with fear. Every hedge is most affordable when you least feel you need it, and unaffordable the week you do.' },
      { lead: 'Set a budget, then buy what it affords', detail: 'Decide the annual percentage you will spend, and size from that. Sizing from what you hope to make back is how hedging becomes its own losing strategy.' },
      { lead: 'Check the contract actually fits', detail: 'One SPY put is roughly $60,000 of notional. On a $30,000 account that is not a hedge, it is a short position with extra steps.' },
    ],
    management: [
      { when: 'Calm markets', detail: 'Hedges cost money and do nothing. This is the normal state and the reason most people abandon them.' },
      { when: 'Volatility rises', detail: 'Long puts gain on volatility alone, before the index reaches them. Convexity starts working before the crash arrives.' },
      { when: 'A real drawdown', detail: 'Consider monetising rather than holding for more. Peaks are brief and the rebound is fast; an unrealised hedge gain can evaporate in days.' },
      { when: 'After monetising', detail: 'Decide deliberately whether to re-establish. Crashes cluster, and the second leg catches people who took the hedge off.' },
      { when: 'Reviewing', detail: 'Judge the programme over years. A hedge assessed on monthly P&L will always look like a mistake right up until it is not.' },
    ],
    mistakes: [
      { lead: 'Hedging after the fall', detail: 'The single most common error. Protection is priced by fear, so buying once you are frightened means paying several times what it cost a month earlier.' },
      { lead: 'Over-hedging a small account', detail: 'One index put against a modest book is not insurance, it is a large short. Contract granularity means small accounts cannot hedge precisely.' },
      { lead: 'Assuming diversification is a hedge', detail: 'Correlations converge toward one in a crash. Twenty positions across twenty names behave like one position in exactly the week that matters.' },
      { lead: 'Trusting bonds automatically', detail: '2022 saw stocks and bonds fall together. The negative correlation people rely on is a regime, not a law.' },
      { lead: 'Hedging instead of sizing', detail: 'If the position is too big, the answer is a smaller position. A hedge bolted onto oversized risk costs money and leaves the judgement error in place.' },
    ],
    extraSections: [
      {
        title: 'Every way people actually hedge',
        body: [
          'Index puts — buy puts on SPY or SPX against the whole book. Direct, convex, and priced accordingly. The standard institutional hedge and the one most retail traders reach for.',
          'Short index futures, or short shares — offsets one for one and costs almost nothing to hold, but it removes the upside as surely as the downside. This is beta hedging, and it is what the calculator below sizes.',
          'Collars on individual positions — long put, short call, financed against each other. Cheap or free, and covered in its own section under Protection.',
          'Tail hedging — far out-of-the-money puts rolled continuously. Small persistent cost, enormous convex payoff. Its own page in this group.',
          'VIX calls and futures — long volatility rather than short market. Powerful in a fast crash, but the term structure bleeds badly in calm markets and the retail products decay hard.',
          'Inverse ETFs — simple to buy and rebalanced daily, which means they decay in choppy markets and do not track over any meaningful horizon. Serviceable for days, poor for months.',
          'Bonds and gold — the traditional diversifiers. Both work sometimes, and both failed to protect in 2022. Treat as regime-dependent, not reliable.',
          'Covered calls — a partial hedge. The premium cushions a small decline and nothing more; it is income with a modest buffer, not protection.',
          'Raising cash — sell some. No cost, no basis risk, no expiry, no counterparty. The most underrated hedge on this list by a wide margin.',
        ],
      },
      {
        title: 'Should a small account hedge?',
        body: [
          'Usually not, and the reasoning is worth understanding because it is not about being unsophisticated.',
          'Funds hedge because they are mandated to stay invested. They cannot go to cash — clients pay them to hold assets, and clients redeem after a bad quarter, so a drawdown costs the manager the business rather than just the money. Hedging is how they stay invested through something they would otherwise have to sell into.',
          'You have neither constraint. You can go to cash on any morning you like, instantly, at no cost, with nobody to explain it to. That option is worth more than any hedge you can buy, and it is free.',
          'The arithmetic is also against you. Continuous protection costs one to two percent a year, compounding against you over decades. And contract sizes do not scale down: one SPY put is around $60,000 of notional, so on a $30,000 account the smallest available hedge is a doubling-down short, not insurance. Micro contracts help, but not enough to hedge precisely.',
          'There is a further advantage funds lack — most small accounts are still being contributed to. New capital arriving during a drawdown does what a hedge does, and buys at the lower prices as well.',
          'So for most accounts, the honest answer is that position sizing is the hedge. Halving the position achieves what the hedge achieves, costs nothing, carries no basis risk, and cannot expire worthless at the wrong moment.',
        ],
      },
      {
        title: 'When a small account should hedge anyway',
        body: [
          'Three cases where the reasoning above flips.',
          'The account has a job soon. If it is a house deposit in eighteen months rather than a thirty-year compounding pot, then sequence matters more than expected return, and paying to cap the downside is rational.',
          'The exposure is concentrated or undefined. A handful of cash-secured puts on correlated names is one position wearing several tickers. Where the risk is genuinely undefined — naked calls, short strangles — hedging stops being optimisation and becomes survival.',
          'You know you would abandon the strategy. If a 30% drawdown would make you stop running something that works, then insurance that keeps you in the seat has value the expected-return arithmetic does not capture. Paying to keep yourself invested is a real reason, provided you are honest that it is the reason.',
          'Outside those, the money is better spent on smaller positions and more cash. That is not a compromise version of hedging — for an account your size it is usually the superior trade.',
        ],
      },
    ],
    calculator: 'beta-hedge',
  },
]

export function strategyById(id) {
  return STRATEGY_CONTENT.find((s) => s.id === id) ?? null
}
