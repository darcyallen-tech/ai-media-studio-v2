import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  label?: string;
};

type State = {
  error: Error | null;
};

export default class NodeErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `${this.props.label || "Node"} crashed`,
      error,
      info.componentStack,
    );
  }

  render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error.message || String(this.state.error);
    return (
      <div className="node-body nodrag" role="alert">
        <p className="hint warn">
          {this.props.label || "This node"} failed to render. The canvas is
          still usable — close this node and try again.
        </p>
        <pre className="crash-log">{message}</pre>
      </div>
    );
  }
}
