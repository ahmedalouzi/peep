import { useWorkspace } from '../hooks/useWorkspace';
import { FileTree } from '../features/explorer/FileTree';
import { useWorkspaceStore } from '../stores/workspace-store';
import { ExtensionsPanel } from '../features/extensions/ExtensionsPanel';
import { GitPanel } from '../features/git/GitPanel';
import { SearchPanel } from '../features/explorer/SearchPanel';

export function Sidebar() {
  const { project, fileTree, openProjectByPath, recentProjects } = useWorkspace();
  const sidebarView = useWorkspaceStore((s) => s.sidebarView);

  if (sidebarView === 'extensions') {
    return <ExtensionsPanel />;
  }

  if (sidebarView === 'search') {
    return <SearchPanel />;
  }

  if (sidebarView === 'git') {
    return <GitPanel />;
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Explorer</span>
        <div className="sidebar-actions">
          <button className="sidebar-btn" title="New File">
            <svg style={{width:'12px',height:'12px',stroke:'currentColor',fill:'none',strokeWidth:'2'}} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <button className="sidebar-btn" title="New Folder">
            <svg style={{width:'12px',height:'12px',stroke:'currentColor',fill:'none',strokeWidth:'2'}} viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button className="sidebar-btn" title="Collapse">
            <svg style={{width:'12px',height:'12px',stroke:'currentColor',fill:'none',strokeWidth:'2'}} viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
        </div>
      </div>
      <div className="sidebar-search">
        <input type="text" placeholder="Filter files..." />
      </div>
      <div className="sidebar-tree">
        {!project ? (
          <>
            {recentProjects.length > 0 && (
              <>
                <div className="tree-section">Recent Projects</div>
                {recentProjects.map((item) => (
                  <div 
                    key={item.id} 
                    className="tree-item"
                    onClick={() => void openProjectByPath(item.path)}
                    title={item.path}
                  >
                    <svg className="tree-icon tree-folder" fill="currentColor" viewBox="0 0 16 16"><path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.19a2 2 0 0 1 1.37.527l.806.806A2 2 0 0 0 9.31 3h3.19a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 1.5H2.5A2 2 0 0 1 .5 13.5V3.87z"/></svg>
                    {item.name}
                  </div>
                ))}
              </>
            )}
          </>
        ) : (
          <>
            <div className="tree-section">{project.name}</div>
            <FileTree entries={fileTree} rootPath={project.path} />
          </>
        )}
      </div>
    </div>
  );
}
