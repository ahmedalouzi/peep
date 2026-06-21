import { createTwoFilesPatch } from 'diff';
import type { ProposedEdit } from '@peep/shared';
import './DiffViewer.css';

interface DiffViewerProps {
  edits: ProposedEdit[];
  onApply: (editIds: string[]) => void;
  onReject: (editIds: string[]) => void;
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function DiffViewer({ edits, onApply, onReject }: DiffViewerProps) {
  if (edits.length === 0) return null;

  return (
    <div className="diff-viewer">
      <div className="diff-viewer__header">
        <span>Proposed changes ({edits.length})</span>
        <div className="diff-viewer__actions">
          <button type="button" className="btn btn-ghost" onClick={() => onReject(edits.map((e) => e.id))}>
            Reject all
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onApply(edits.map((e) => e.id))}>
            Apply all
          </button>
        </div>
      </div>

      {edits.map((edit) => {
        const patch = createTwoFilesPatch(
          fileName(edit.path),
          fileName(edit.path),
          edit.originalContent,
          edit.proposedContent,
        );

        return (
          <div key={edit.id} className="diff-card">
            <div className="diff-card__header">
              <div>
                <strong>{fileName(edit.path)}</strong>
                {edit.description && <p className="diff-card__desc">{edit.description}</p>}
              </div>
              <div className="diff-card__actions">
                <button type="button" className="btn btn-ghost" onClick={() => onReject([edit.id])}>
                  Reject
                </button>
                <button type="button" className="btn btn-primary" onClick={() => onApply([edit.id])}>
                  Apply
                </button>
              </div>
            </div>
            <pre className="diff-card__patch">{patch}</pre>
          </div>
        );
      })}
    </div>
  );
}
