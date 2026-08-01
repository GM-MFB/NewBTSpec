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
]

export function strategyById(id) {
  return STRATEGY_CONTENT.find((s) => s.id === id) ?? null
}
