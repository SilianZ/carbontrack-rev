import Silian_React from 'react';
import { AlertCircle as Silian_AlertCircle } from 'lucide-react';
import { Button as Silian_Button } from '../ui/Button';
import Silian_PropTypes from 'prop-types';

export default class RouteErrorBoundary extends Silian_React.Component {
  constructor(Silian_props) {
    super(Silian_props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(Silian_error) {
    return { hasError: true, error: Silian_error };
  }

  componentDidCatch() {
    // 可以在此处上报错误日志到后端
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (typeof this.props.onRetry === 'function') {
      this.props.onRetry();
      return;
    }
    // 默认行为：刷新当前页面
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    const { hasError: Silian_hasError } = this.state;
    const { t: Silian_t } = this.props; // 允许外部传入翻译函数，避免在错误状态下的 hooks 使用

    if (!Silian_hasError) return this.props.children;

    const Silian_translate = typeof Silian_t === 'function' ? Silian_t : (Silian_k) => Silian_k;

    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-xl mx-auto bg-white border rounded-lg shadow-sm p-6 text-center">
          <div className="flex items-center justify-center mb-4 text-red-600">
            <Silian_AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">{Silian_translate('errors.unexpected')}</h2>
          <p className="text-muted-foreground mb-6">{Silian_translate('errors.tryAgain')}</p>
          <div className="flex justify-center">
            <Silian_Button variant="outline" onClick={this.handleRetry}>
              {Silian_translate('common.retry')}
            </Silian_Button>
          </div>
        </div>
      </div>
    );
  }
}

RouteErrorBoundary.propTypes = {
  t: Silian_PropTypes.func,
  onRetry: Silian_PropTypes.func,
  children: Silian_PropTypes.node,
};
