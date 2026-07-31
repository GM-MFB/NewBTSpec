const STEPS = [
  { n: 1, title: 'Sell a cash-secured put', detail: 'Set aside strike × 100. Collect premium now.', tone: 'income' },
  { n: 2, title: 'Expires worthless?', detail: 'Keep the premium and return to step 1. This is the loop that pays.', tone: 'loop' },
  { n: 3, title: 'Assigned', detail: 'Own 100 shares per contract. Cost basis is strike − premium.', tone: 'shift' },
  { n: 4, title: 'Sell a covered call', detail: 'At or above cost basis. Never below. Collect premium again.', tone: 'income' },
  { n: 5, title: 'Called away', detail: 'Shares sold at the call strike. Back to step 1.', tone: 'loop' },
]

export default function WheelCycle() {
  return (
    <div className="wheel-cycle" data-testid="wheel-cycle">
      {STEPS.map((step, i) => (
        <div className="wheel-step-wrap" key={step.n}>
          <div className={`wheel-step wheel-step--${step.tone}`}>
            <span className="wheel-step-num">{step.n}</span>
            <span className="wheel-step-title">{step.title}</span>
            <span className="wheel-step-detail">{step.detail}</span>
          </div>
          {i < STEPS.length - 1 && <span className="wheel-arrow" aria-hidden="true">↓</span>}
        </div>
      ))}
      <p className="wheel-cycle-note">
        Steps 2 and 5 both return to the start — that return is the wheel turning.
        Step 3 is not a failure; it is the strategy doing what it was designed to do.
      </p>
    </div>
  )
}
