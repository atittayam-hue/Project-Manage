export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';

export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';

export type ViewMode = 'dashboard' | 'kanban' | 'list' | 'github';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
  initials: string;
}

export interface ProjectSpace {
  id: string;
  name: string;
  key: string;
  description: string;
  color: string;
  githubRepo?: string;
  createdAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  mentions?: string[];
  createdAt: string;
}

export interface TaskItem {
  id: string;
  code: string;
  spaceId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  assigneeIds?: string[];
  dueDate: string;
  order: number;
  tags: string[];
  subtasks: Subtask[];
  comments: TaskComment[];
  githubIssueNumber?: number;
  githubIssueUrl?: string;
  githubRepo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  actorName: string;
  action: string;
  targetTitle: string;
  spaceId: string;
  createdAt: string;
}

export interface ActiveClient {
  clientId: string;
  memberId: string;
  name: string;
  joinedAt: string;
}

export interface WorkspaceState {
  spaces: ProjectSpace[];
  tasks: TaskItem[];
  members: TeamMember[];
  activities: ActivityLog[];
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

export interface GitHubRepoInfo {
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  open_issues_count: number;
  default_branch: string;
  private: boolean;
  language: string | null;
  updated_at: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  labels: Array<{
    name: string;
    color: string;
  }>;
  pull_request?: unknown;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  head: {
    ref: string;
  };
  base: {
    ref: string;
  };
}

export type WsServerEvent =
  | {
      type: 'init';
      state: WorkspaceState;
      activeClients: ActiveClient[];
      clientId: string;
    }
  | {
      type: 'presence:update';
      activeClients: ActiveClient[];
    }
  | {
      type: 'task:created';
      task: TaskItem;
      activity?: ActivityLog;
    }
  | {
      type: 'task:updated';
      task: TaskItem;
      activity?: ActivityLog;
    }
  | {
      type: 'task:moved';
      task: TaskItem;
      tasksOrder: Array<{ id: string; status: TaskStatus; order: number }>;
      activity?: ActivityLog;
    }
  | {
      type: 'task:deleted';
      taskId: string;
      activity?: ActivityLog;
    }
  | {
      type: 'task:comment_added';
      taskId: string;
      comment: TaskComment;
      activity?: ActivityLog;
    }
  | {
      type: 'space:created';
      space: ProjectSpace;
      activity?: ActivityLog;
    }
  | {
      type: 'space:updated';
      space: ProjectSpace;
    }
  | {
      type: 'space:deleted';
      spaceId: string;
    }
  | {
      type: 'member:created';
      member: TeamMember;
    }
  | {
      type: 'member:deleted';
      memberId: string;
    }
  | {
      type: 'workspace:reset';
      state: WorkspaceState;
    };
