import StrategyCalculator from './StrategyCalculator'

function List({ title, items, testId }) {
  return (
    <section className="strategy-section" data-testid={testId}>
      <h3 className="strategy-section-title">{title}</h3>
      <ul className="strategy-list">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  )
}

export default function StrategyArticle({ strategy }) {
  return (
    <article className="strategy-article" data-testid={`strategy-article-${strategy.id}`}>
      <header className="strategy-header">
        <h2 className="strategy-name">{strategy.name}</h2>
        <div className="strategy-tags">
          <span className="strategy-tag">{strategy.outlook}</span>
          <span className="strategy-tag">Capital: {strategy.capital}</span>
        </div>
        <p className="strategy-summary">{strategy.summary}</p>
      </header>

      <section className="strategy-section" data-testid="strategy-legs">
        <h3 className="strategy-section-title">The Position</h3>
        <ol className="strategy-legs">
          {strategy.legs.map((leg) => <li key={leg}>{leg}</li>)}
        </ol>
      </section>

      <section className="strategy-section" data-testid="strategy-key-facts">
        <h3 className="strategy-section-title">Key Facts</h3>
        <dl className="strategy-facts">
          {strategy.keyFacts.map(([term, value]) => (
            <div className="strategy-fact" key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <List title="Entry" items={strategy.entry} testId="strategy-entry" />
      <List title="Management" items={strategy.management} testId="strategy-management" />
      <List title="Common Mistakes" items={strategy.mistakes} testId="strategy-mistakes" />

      {(strategy.extraSections ?? []).map((section) => (
        <section className="strategy-section strategy-section--extra" key={section.title}>
          <h3 className="strategy-section-title">{section.title}</h3>
          {section.body.map((paragraph) => (
            <p className="strategy-paragraph" key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}

      <StrategyCalculator kind={strategy.calculator} />
    </article>
  )
}
