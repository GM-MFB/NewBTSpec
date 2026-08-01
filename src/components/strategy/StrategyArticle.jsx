import WheelCycle from './WheelCycle'
import { exampleFor } from '../../lib/strategyExamples'

const ACTION_LABEL = { sell: 'Sell', buy: 'Buy', hold: 'Hold' }

// The comparison strip. Every strategy answers the same five questions, so they
// can be read against each other without reading the prose.
function Glance({ glance }) {
  const cells = [
    { label: 'Risk', value: glance.risk, tone: glance.riskTone },
    { label: 'Direction', value: glance.direction },
    { label: 'Volatility', value: glance.volatility },
    { label: 'Capital', value: glance.capital },
    { label: 'Legs', value: glance.legs },
  ]

  return (
    <div className="glance" data-testid="strategy-glance">
      {cells.map((cell) => (
        <div className="glance-cell" key={cell.label}>
          <span className="glance-label">{cell.label}</span>
          <span className={`glance-value ${cell.tone ? `glance-value--${cell.tone}` : ''}`}>{cell.value}</span>
        </div>
      ))}
    </div>
  )
}

// Drawn like a trade ticket so the structure reads at a glance: what is sold,
// what is bought, and in what order.
function Legs({ legs }) {
  return (
    <section className="strategy-section" data-testid="strategy-legs">
      <h3 className="strategy-section-title">The Position</h3>
      <ul className="leg-list">
        {legs.map((leg) => (
          <li className={`leg leg--${leg.action}`} key={leg.text}>
            <span className="leg-action">{ACTION_LABEL[leg.action]}</span>
            <span className="leg-text">{leg.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function KeyFacts({ facts }) {
  return (
    <section className="strategy-section" data-testid="strategy-key-facts">
      <h3 className="strategy-section-title">Key Facts</h3>
      <dl className="strategy-facts">
        {facts.map(([term, value, tone]) => (
          <div className={`strategy-fact ${tone ? `strategy-fact--${tone}` : ''}`} key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Checklist({ items }) {
  return (
    <section className="strategy-section" data-testid="strategy-entry">
      <h3 className="strategy-section-title">Entry Checklist</h3>
      <ul className="check-list">
        {items.map((item) => (
          <li className="check-item" key={item.lead}>
            <span className="check-mark" aria-hidden="true">✓</span>
            <span className="check-lead">{item.lead}</span>
            <span className="check-detail">{item.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// A trade has a life, so management is drawn along it rather than bulleted.
function Timeline({ items }) {
  return (
    <section className="strategy-section" data-testid="strategy-management">
      <h3 className="strategy-section-title">Managing the Trade</h3>
      <ol className="timeline">
        {items.map((item) => (
          <li className="timeline-item" key={item.when}>
            <span className="timeline-when">{item.when}</span>
            <span className="timeline-detail">{item.detail}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Mistakes({ items }) {
  return (
    <section className="strategy-section" data-testid="strategy-mistakes">
      <h3 className="strategy-section-title">Common Mistakes</h3>
      <ul className="mistake-list">
        {items.map((item) => (
          <li className="mistake" key={item.lead}>
            <span className="mistake-lead">{item.lead}</span>
            <span className="mistake-detail">{item.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// A concrete trade with its branches. Prose describes what a strategy is;
// this shows what actually happens, including the outcomes nobody advertises.
function WorkedExample({ example }) {
  return (
    <section className="strategy-section" data-testid="strategy-example">
      <h3 className="strategy-section-title">Worked Example</h3>
      <p className="example-setup">{example.setup}</p>
      <ul className="example-outcomes">
        {example.outcomes.map((outcome) => (
          <li className={`example-outcome example-outcome--${outcome.tone ?? 'neutral'}`} key={outcome.label}>
            <span className="example-outcome-label">{outcome.label}</span>
            <span className="example-outcome-detail">{outcome.detail}</span>
          </li>
        ))}
      </ul>
      <p className="example-lesson">{example.lesson}</p>
    </section>
  )
}

export default function StrategyArticle({ strategy }) {
  const example = exampleFor(strategy.id)

  return (
    <article className="strategy-article" data-testid={`strategy-article-${strategy.id}`}>
      <header className="strategy-header">
        <h2 className="strategy-name">{strategy.name}</h2>
        <p className="strategy-summary">{strategy.summary}</p>
      </header>

      <Glance glance={strategy.glance} />
      <Legs legs={strategy.legs} />
      <KeyFacts facts={strategy.keyFacts} />
      <Checklist items={strategy.entry} />
      <Timeline items={strategy.management} />
      {example && <WorkedExample example={example} />}
      <Mistakes items={strategy.mistakes} />

      {(strategy.extraSections ?? []).map((section) => (
        <section className="strategy-section strategy-section--extra" key={section.title}>
          <h3 className="strategy-section-title">{section.title}</h3>
          {/* The cycle is a sequence, so it is drawn rather than described. */}
          {section.title === 'The cycle' ? <WheelCycle /> : section.body.map((paragraph) => (
            <p className="strategy-paragraph" key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
    </article>
  )
}
