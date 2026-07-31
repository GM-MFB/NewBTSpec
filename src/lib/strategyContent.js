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
          'The options then are the same as for any losing position — hold with conviction, average down deliberately, or take the loss. Selling covered calls below basis is not a fourth option, it is choosing the loss without admitting it.',
          'The defence is entirely at entry: only wheel names you would hold through a drawdown.',
        ],
      },
    ],
    calculator: 'wheel',
  },

  {
    id: 'credit-spread',
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
]

export function strategyById(id) {
  return STRATEGY_CONTENT.find((s) => s.id === id) ?? null
}
