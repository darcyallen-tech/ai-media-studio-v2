import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  onBackToImage?: () => void;
};

type State = {
  error: Error | null;
};

export default class PromptErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Prompt/Frame crashed", error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onBackToImage?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error.message || String(this.state.error);
    return (
      <div className="prompt-crash nodrag" role="alert">
        <p className="hint warn">Frame layout failed — the rest of the app is still up.</p>
        <pre className="crash-log">{message}</pre>
        <button type="button" className="ghost" onClick={this.reset}>
          Back to Image
        </button>
      </div>
    );
  }
}
