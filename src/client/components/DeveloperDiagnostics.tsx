import React from 'react';

export interface TokenDefinition {
  name: string;
  lightHex: string;
  darkHex: string;
  purpose: string;
}

export const DESIGN_TOKENS: TokenDefinition[] = [
  { name: 'desk', lightHex: '#F5F6F3', darkHex: '#151A18', purpose: 'Workspace background desk surface' },
  { name: 'sheet', lightHex: '#FFFFFF', darkHex: '#1C2420', purpose: 'Paper invoice & ledger sheet surface' },
  { name: 'sheet-2', lightHex: '#EEF1ED', darkHex: '#242E29', purpose: 'Secondary soft surface' },
  { name: 'ink', lightHex: '#202923', darkHex: '#E9EFEA', purpose: 'Primary typography & ledger figures' },
  { name: 'ink-muted', lightHex: '#66716A', darkHex: '#A5B0A8', purpose: 'Secondary labels & metadata' },
  { name: 'rule', lightHex: '#DEE4DF', darkHex: '#344139', purpose: 'Fine ledger & table rules' },
  { name: 'primary', lightHex: '#285B4A', darkHex: '#8FBFA6', purpose: 'Primary interactive control' },
  { name: 'on-primary', lightHex: '#FFFFFF', darkHex: '#11231B', purpose: 'Contrast text on primary surface' },
  { name: 'highlight', lightHex: '#F3EFE6', darkHex: 'rgba(180, 160, 120, 0.15)', purpose: 'Restrained approval review highlight' },
  { name: 'paid', lightHex: '#236B4D', darkHex: '#68C194', purpose: 'Verified paid status accent' },
  { name: 'late', lightHex: '#A83832', darkHex: '#E26D68', purpose: 'Overdue / error status accent' },
  { name: 'caution', lightHex: '#94601A', darkHex: '#E09F45', purpose: 'Pending approval / mock warning accent' },
  { name: 'info', lightHex: '#315A75', darkHex: '#7FA7C4', purpose: 'Sandbox environment & informational accent' }
];

export interface StageGroupRow {
  id: string;
  title: string;
  stageTarget: string;
  status: string;
}

export const BASELINE_FEATURE_GROUPS: StageGroupRow[] = [
  { id: 'Stage 01', title: 'App/repo foundation, design tokens, responsive shell, health check', stageTarget: 'Stage 1', status: 'VERIFIED' },
  { id: 'F-007 / Stage 02-08', title: 'PayPal Sandbox proof, isolated adapter, approved send & live status refresh', stageTarget: 'Stages 2–3, 8', status: 'VERIFIED' },
  { id: 'F-004 / F-006', title: 'SQLite persistence, owner isolation, Clients & conventional Invoices CRUD', stageTarget: 'Stages 4–5', status: 'VERIFIED' },
  { id: 'F-005 / F-010', title: 'Signature Approval Slip state machine & append-oriented Activity log', stageTarget: 'Stage 6', status: 'VERIFIED' },
  { id: 'F-003', title: 'Constrained Gemini AI invoice draft agent with form fallback', stageTarget: 'Stage 7', status: 'VERIFIED' },
  { id: 'F-008 / F-009', title: 'Client-aware reminder drafts & grounded aging/cash-flow insights', stageTarget: 'Stages 9–12', status: 'VERIFIED' },
  { id: 'F-013 / Stage 13', title: 'MCP vs REST evaluation & direct REST architectural decision (D-005)', stageTarget: 'Stage 13', status: 'VERIFIED' },
  { id: 'F-001 / F-011-014', title: 'Help/FAQ, Policies, Templates, Webhook viewer, Account deletion & settings', stageTarget: 'Stage 14', status: 'VERIFIED' }
];

export interface DeveloperDiagnosticsProps {
  view: 'tokens' | 'roadmap';
}

export const DeveloperDiagnostics: React.FC<DeveloperDiagnosticsProps> = ({ view }) => {
  if (view === 'tokens') {
    return (
      <section aria-labelledby="section-tokens-title">
        <div className="sheet-header">
          <div>
            <h2 id="section-tokens-title" className="sheet-title">
              Paper ledger &amp; approval slip design tokens
            </h2>
            <p className="sheet-lead">
              Exact color palette and typography (<code>Hanken Grotesk</code> UI + <code>Newsreader</code> financial documents + tabular numerals) from <code>docs/UI_UX_DESIGN.md</code>.
            </p>
          </div>
        </div>

        <div className="ledger-table-wrap">
          <table className="ledger-table" aria-label="UI design token inventory">
            <thead>
              <tr>
                <th scope="col">Token</th>
                <th scope="col">Light value</th>
                <th scope="col">Dark value</th>
                <th scope="col">Role</th>
              </tr>
            </thead>
            <tbody>
              {DESIGN_TOKENS.map((token) => (
                <tr key={token.name}>
                  <td>
                    <code>--{token.name}</code>
                  </td>
                  <td className="tabular-nums">
                    <code>{token.lightHex}</code>
                  </td>
                  <td className="tabular-nums">
                    <code>{token.darkHex}</code>
                  </td>
                  <td>{token.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="section-roadmap-title">
      <div className="sheet-header">
        <div>
          <h2 id="section-roadmap-title" className="sheet-title">
            Implementation honesty &amp; stage status
          </h2>
          <p className="sheet-lead">
            Stages 00 through 05 are implemented and verified. Later stages remain <code>NOT STARTED</code> until built and verified with reproducible tests.
          </p>
        </div>
      </div>

      <div className="ledger-table-wrap">
        <table className="ledger-table" aria-label="Implementation stage ledger">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Scope item</th>
              <th scope="col">Target stage</th>
              <th scope="col">Current status</th>
            </tr>
          </thead>
          <tbody>
            {BASELINE_FEATURE_GROUPS.map((row) => (
              <tr key={row.id}>
                <td className="tabular-nums">{row.id}</td>
                <td>{row.title}</td>
                <td className="tabular-nums">{row.stageTarget}</td>
                <td>
                  <span
                    className="status-pill"
                    data-tone={row.status === 'VERIFIED' ? 'paid' : 'caution'}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

