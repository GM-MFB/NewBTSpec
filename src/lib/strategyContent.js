// Reference content for the Strategy page. Kept as data rather than JSX so all
// five strategies stay the same shape and a sixth is a data addition, not a new
// component.

export const STRATEGY_CONTENT = [
  {
    id: 'wheel',
    name: 'The Wheel',
    outlook: 'Neutral to bullish',
    capital: 'High — full strike collateral per contract',
    summary:
      'Sell cash-secured puts on a stock you would be content to own. Collect premium while the put expires worthless, and repeat. If assigned, you own 100 shares per contract and switch to selling covered calls against them until the shares are called away — at which point you are back to selling puts. The income is the premium; the risk is that you end up holding a stock that keeps falling.',
    legs: [
      'Leg 1 — sell 1 cash-secured put, collateral = strike × 100',
      'If assigned — buy 100 shares at the strike',
      'Leg 2 — sell 1 covered call against those 100 shares',
      'If called away — deliver the shares at the call strike, cycle restarts',
    ],
    keyFacts: [
      ['Max profit', 'The premium collected, on each leg'],
      ['Max loss', 'Strike minus premium, per share, if the stock goes to zero'],
      ['Breakeven (put leg)', 'Strike − premium collected'],
      ['Capital required', 'Strike × 100 per contract, held as collateral'],
    ],
    entry: [
      'Only wheel a stock you genuinely want to own at the strike. This is the whole risk control — if you would not buy the shares there, do not sell the put.',
      'Strike selection is typically around the 0.16–0.30 delta band: far enough out to usually expire worthless, close enough to pay meaningfully.',
      '30–45 days to expiration is the common window — time decay accelerates over that stretch while still paying enough to be worth the collateral.',
      'Prefer elevated implied volatility. You are selling volatility; when IV is low you are paid little for the same downside.',
      'Size so that assignment is survivable. If being assigned every open put at once would wreck the account, the position is too large.',
    ],
    management: [
      'Closing at roughly 50% of maximum profit is a common target — the remaining premium takes disproportionately longer to earn.',
      'Around 21 days to expiration, decide: close, roll, or accept assignment. Gamma rises sharply in the last weeks and the position gets twitchy.',
      'Roll out (and down, if you can do it for a credit) when the stock has moved through your strike but you still want to avoid assignment.',
      'Accepting assignment is not a failure. It is the strategy working as designed — you now own a stock you said you wanted, at a discount to where it was.',
      'Never sell a covered call below your cost basis. See the sections below.',
    ],
    mistakes: [
      'Wheeling a stock chosen for its premium rather than for wanting to own it. High premium is the market pricing high risk, and it is usually right.',
      'Selling covered calls below cost basis to "collect something" after the stock dropped. That locks in a loss the moment you are called away.',
      'Forgetting that cost basis after assignment is the strike minus premium collected, not the strike — which makes the position look worse than it is.',
      'Selling puts on far more names than the account could actually take assignment on. Correlated drawdowns assign everything at once.',
      'Rolling a losing position for a debit repeatedly. Each roll should bring in a credit; paying to postpone is just adding to a loser.',
    ],
    extraSections: [
      {
        title: 'The cycle',
        body: [
          'Step 1 — Sell a cash-secured put. Set aside strike × 100 in collateral. Collect the premium immediately.',
          'Step 2 — If the put expires out of the money, keep the premium and go back to step 1. This is the loop that pays.',
          'Step 3 — If the put finishes in the money, you are assigned: 100 shares per contract at the strike price.',
          'Step 4 — Sell a covered call against those shares, at or above your cost basis. Collect premium again.',
          'Step 5 — If the call is exercised, the shares are sold at that strike and you return to step 1. If it expires worthless, sell another call.',
        ],
      },
      {
        title: 'What assignment does to your cost basis',
        body: [
          'Assignment happens at the strike, but the strike is not your cost basis — you were paid a premium to take the shares.',
          'Sell a $380 put for $2.00 and get assigned: you paid $380 per share and were paid $2.00, so your basis is $378.',
          'This matters on the way out. A covered call at $379 looks like it is above the strike you were assigned at, but it is above your basis too, so being called away is a small win rather than a loss.',
          'Every subsequent covered call premium lowers the basis further. Tracking that number, not the assignment strike, is what tells you whether the wheel is actually working on this name.',
        ],
      },
      {
        title: 'Never sell a covered call below your cost basis',
        body: [
          'This is the single most common way a profitable-looking wheel turns negative.',
          'Assigned at $378 basis, the stock drops to $340, and the $345 call is paying well. Sell it, the stock rallies to $360, and you are called away at $345 — a $33 per share loss, crystallised, in exchange for a couple of dollars of premium.',
          'If the shares are underwater and no call above your basis pays anything worth having, the correct move is usually to sell nothing and wait, or to accept the loss deliberately rather than have a call decide it for you.',
          'The calculator below shows this outcome as a negative number on purpose.',
        ],
      },
      {
        title: 'When the stock craters',
        body: [
          'The wheel is a strategy for stocks that trade sideways or grind up. A name in genuine decline turns it into a slow-motion bag hold with a small income stream attached.',
          'Warning sign: the premium you can collect above your cost basis has become negligible, so the wheel has stopped turning and you are simply long a falling stock.',
          'The options at that point are the same as for any losing position — hold with conviction, average down deliberately, or take the loss. Selling covered calls below basis is not a fourth option, it is choosing the loss without admitting it.',
          'The defence against this is entirely at entry: only wheel names you would hold through a drawdown.',
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
    summary:
      'Sell an option and buy a further out-of-the-money option in the same expiry. You take in a net credit, and the long leg caps your loss at the width of the spread. A put credit spread profits if the stock stays above the short strike; a call credit spread if it stays below. It is the defined-risk answer to a cash-secured put — far less capital, and a far smaller maximum profit.',
    legs: [
      'Sell 1 option closer to the money (the short leg — this is what pays)',
      'Buy 1 option further from the money, same expiry (the long leg — this is the insurance)',
      'Net result: a credit into the account',
    ],
    keyFacts: [
      ['Max profit', 'The net credit received'],
      ['Max loss', 'Spread width − credit'],
      ['Breakeven', 'Put spread: short strike − credit. Call spread: short strike + credit'],
      ['Capital required', 'The max loss — brokers hold width − credit'],
    ],
    entry: [
      'Short strike around 0.16–0.30 delta, same reasoning as the wheel: probability of expiring worthless against premium collected.',
      '30–45 DTE is again the common window.',
      'Sell into elevated IV. Credit spreads are short volatility, and a low-IV credit spread pays badly for the same defined risk.',
      'Width is a risk dial: wider collects more credit but risks more. A $1 wide spread risking $60 to make $40 is a very different trade from a $5 wide risking $380 to make $120.',
      'Look for a credit of roughly a third of the width or better — below that the risk/reward stops justifying the tail.',
    ],
    management: [
      'Close at around 50% of max profit, as with any short-premium position.',
      'Manage at 21 DTE. A defined-risk spread can still lose its entire width in the final days.',
      'Roll out for a credit when the short strike is threatened and you still believe the thesis.',
      'The max loss is real and reachable. Unlike a cash-secured put, there is no "just take assignment" escape — the spread simply expires at full loss.',
    ],
    mistakes: [
      'Treating the small capital requirement as small risk, then sizing up until the aggregate max loss is enormous.',
      'Selling spreads so narrow that commissions and slippage eat the edge.',
      'Letting a spread go to expiration in the money hoping for a reversal. Max loss arrives quickly at the end.',
      'Ignoring that both legs must be closed. A long leg left open after the short is closed is a naked directional bet.',
    ],
    calculator: 'credit-spread',
  },

  {
    id: 'debit-spread',
    name: 'Debit Spreads',
    outlook: 'Directional, with defined risk and capped upside',
    capital: 'The debit paid',
    summary:
      'Buy an option and sell a further out-of-the-money option in the same expiry. You pay a net debit, which is the entire risk. The short leg subsidises the purchase in exchange for capping the profit at the spread width. It is a cheaper, lower-breakeven way to express a directional view than buying the option outright — at the cost of giving up the unlimited tail.',
    legs: [
      'Buy 1 option closer to the money (the long leg — the directional bet)',
      'Sell 1 option further from the money, same expiry (the short leg — subsidy, and the cap)',
      'Net result: a debit out of the account',
    ],
    keyFacts: [
      ['Max profit', 'Spread width − debit paid'],
      ['Max loss', 'The debit paid, in full'],
      ['Breakeven', 'Call spread: long strike + debit. Put spread: long strike − debit'],
      ['Capital required', 'The debit'],
    ],
    entry: [
      'Use when you have a directional view with a target. The short strike should sit at or near where you expect the move to stop — you gain nothing beyond it.',
      'Prefer low implied volatility. You are net long premium, so cheap options help you, which is the mirror image of credit spreads.',
      'Give the thesis time. Debit spreads need the move to actually happen; 45–60 DTE is common so time decay is not the primary opponent.',
      'Paying more than about two thirds of the width means risking a lot to make a little.',
    ],
    management: [
      'Take profit when a good fraction of the width has been captured. The last portion decays slowly and only arrives at expiration.',
      'Time decay works against you here, unlike every short-premium strategy on this page. A spread that is right but slow still loses.',
      'There is no rolling out of a debit spread cheaply — extending usually means paying again. Consider closing rather than adding.',
    ],
    mistakes: [
      'Buying debit spreads in high IV, then being right on direction and still losing as volatility contracts.',
      'Choosing a short strike beyond any realistic target, which pays for width that will never be reached.',
      'Holding to expiration for the last few dollars of a spread that is already most of the way to max profit.',
    ],
    calculator: 'debit-spread',
  },

  {
    id: 'calendar-spread',
    name: 'Calendar Spreads',
    outlook: 'Neutral near-term, and long volatility',
    capital: 'The net debit paid',
    summary:
      'Sell a near-dated option and buy a longer-dated option at the same strike. The near leg decays faster than the far leg, and that differential is the profit engine. It also gains if implied volatility rises, because the long-dated option has more vega. It wants the underlying to sit near the strike through the near-term expiry — a genuinely neutral position with an unusual profit profile.',
    legs: [
      'Sell 1 option at the chosen strike, near-dated',
      'Buy 1 option at the same strike, further-dated',
      'Net result: a debit, since the longer option costs more',
    ],
    keyFacts: [
      ['Max profit', 'Not calculable in closed form — see below'],
      ['Max loss', 'The net debit paid'],
      ['Breakeven', 'Two, both moving — they depend on implied volatility at the near expiry'],
      ['Capital required', 'The debit'],
    ],
    entry: [
      'Place the strike where you expect the underlying to be at the near-term expiry — usually at the money for a neutral view.',
      'Enter when implied volatility is low and you expect it to rise. Rising IV helps the long leg more than the short.',
      'A common structure has the near leg around 30 days out and the far leg 60, giving a clear decay differential.',
      'Avoid holding through an earnings report inside the near leg unless that is deliberately the trade — the volatility crush afterwards can gut it.',
    ],
    management: [
      'Usually closed as a unit at or shortly before the near-term expiry, rather than held through it.',
      'The position is hurt by a large move in either direction. Its profit zone is a range around the strike, not a direction.',
      'If the near leg is assigned early — more likely with in-the-money calls before a dividend — the structure breaks and needs immediate attention.',
    ],
    mistakes: [
      'Expecting a clean maximum profit figure. There is not one, and any tool that shows you a confident number is modelling assumptions it has not told you about.',
      'Entering when implied volatility is already high, which puts the vega exposure against you.',
      'Letting the near leg expire in the money and being assigned unexpectedly, leaving a naked long-dated option plus a stock position.',
      'Treating it as a set-and-forget income trade. It needs the underlying to cooperate on both price and volatility.',
    ],
    extraSections: [
      {
        title: 'Why there is no max profit number',
        body: [
          'Every other strategy on this page settles into a fixed payoff at expiration, so max profit is arithmetic.',
          'A calendar does not. When the near leg expires, the far leg is still alive, and what it is worth then depends on implied volatility at that moment and on how close the underlying is to the strike.',
          'Both of those are unknowable at entry. Profit is highest when the stock sits exactly at the strike at the near expiry with volatility elevated — but "highest" there is a function of inputs that do not exist yet.',
          'So the calculator reports max loss, which is fixed and knowable, and reports nothing for max profit. A number there would be a model output dressed up as a fact.',
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
    summary:
      'A put credit spread and a call credit spread on the same underlying and expiry, bracketing the current price. You collect both credits and keep them all if the stock finishes between the short strikes. It is the purest expression of "this is going nowhere" — defined risk on both sides, and a profit zone rather than a direction.',
    legs: [
      'Sell 1 put below the price, buy 1 further put below it (put credit spread)',
      'Sell 1 call above the price, buy 1 further call above it (call credit spread)',
      'Net result: a credit, from both spreads combined',
    ],
    keyFacts: [
      ['Max profit', 'The total net credit, if price finishes between the short strikes'],
      ['Max loss', 'Wider wing width − credit. Only one side can lose'],
      ['Breakevens', 'Short put − credit, and short call + credit'],
      ['Capital required', 'The max loss — brokers margin the wider side only'],
    ],
    entry: [
      'Short strikes around 0.16 delta on each side is a common starting point, giving a wide profit range.',
      '30–45 DTE, as with the other short-premium structures.',
      'Sell into high implied volatility. A condor is short volatility on both sides and wants IV to fall.',
      'Keep the wings the same width unless you deliberately want a skew — equal wings mean the margin matches either side.',
      'Best on range-bound underlyings and broad indices. A trending stock will run through a wing.',
    ],
    management: [
      'Close at around 50% of max profit. Holding a condor to expiration for the last of the credit is where the losses come from.',
      'Manage the threatened side rather than the whole position — roll the tested spread out or further away for a credit.',
      'Both sides are rarely tested. Only one can finish in the money, which is why max loss uses the wider wing rather than the sum.',
      'At 21 DTE, decide. Gamma near expiry is what turns a comfortable condor into a full-width loss in a day.',
    ],
    mistakes: [
      'Setting the wings too close to collect more credit, which converts a range bet into a coin flip.',
      'Assuming both sides can lose and over-estimating the risk — or worse, under-estimating margin by netting them.',
      'Putting condors on trending names because the premium looks attractive.',
      'Holding through expiration week to squeeze the last of the credit.',
    ],
    calculator: 'iron-condor',
  },
]

export function strategyById(id) {
  return STRATEGY_CONTENT.find((s) => s.id === id) ?? null
}
