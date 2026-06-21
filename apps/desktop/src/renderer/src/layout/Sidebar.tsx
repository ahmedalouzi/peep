import { useWorkspace } from '../hooks/useWorkspace';
import { FileTree } from '../features/explorer/FileTree';
import { NoProjectEmptyState } from '../features/shared/EmptyState';
import './Sidebar.css';

export function Sidebar() {
  const { project, fileTree, openProjectFolder, openProjectByPath, recentProjects } =
    useWorkspace();

  const handleNewProject = () => {
    window.dispatchEvent(new CustomEvent('peep:new-project'));
  };

  return (
    <aside className="panel sidebar">
      <div className="panel-header">
        <span className="panel-title">Explorer</span>
      </div>
      <div className="panel-body sidebar__body">
        {!project ? (
          <>
            <NoProjectEmptyState
              onOpen={() => void openProjectFolder()}
              onNew={handleNewProject}
            />
            {recentProjects.length > 0 && (
              <div className="sidebar__recent">
                <span className="sidebar__recent-label">Recent</span>
                <ul>
                  {recentProjects.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="sidebar__recent-item"
                        onClick={() => void openProjectByPath(item.path)}
                        title={item.path}
                      >
                        {item.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <FileTree entries={fileTree} rootPath={project.path} />
        )}
      </div>
    </aside>
  );
}
