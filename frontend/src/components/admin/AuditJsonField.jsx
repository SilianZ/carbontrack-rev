import Silian_React, { useState as Silian_useState } from 'react';
import { Button as Silian_Button } from '@/components/ui/Button';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '@/components/ui/Card';
import { Copy as Silian_Copy, Check as Silian_Check } from 'lucide-react';

const Silian_AuditJsonField = ({ json: Silian_json, title: Silian_title }) => {
  const [Silian_isCopied, Silian_setIsCopied] = Silian_useState(false);
  const [Silian_isExpanded, Silian_setIsExpanded] = Silian_useState(false);

  const Silian_formattedJson = JSON.stringify(Silian_json, null, 2);
  const Silian_jsonString = typeof Silian_formattedJson === 'string' ? Silian_formattedJson : JSON.stringify(Silian_json, null, 2);

  const Silian_copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(Silian_jsonString);
      Silian_setIsCopied(true);
      setTimeout(() => Silian_setIsCopied(false), 2000);
    } catch (Silian_err) {
      console.error('Failed to copy JSON:', Silian_err);
    }
  };

  return (
    <Silian_Card className="mb-3">
      <Silian_CardHeader className="flex items-center justify-between">
        <Silian_CardTitle className="text-sm font-medium">{Silian_title}</Silian_CardTitle>
        <div className="flex items-center gap-2">
          <Silian_Button
            variant="ghost"
            size="sm"
            onClick={Silian_copyToClipboard}
            className="h-6 w-6 p-0"
            title="Copy JSON"
          >
            {Silian_isCopied ? <Silian_Check className="h-3 w-3" /> : <Silian_Copy className="h-3 w-3" />}
          </Silian_Button>
          <Silian_Button
            variant="ghost"
            size="sm"
            onClick={() => Silian_setIsExpanded(!Silian_isExpanded)}
            className="h-6 w-6 p-0"
            title={Silian_isExpanded ? 'Collapse' : 'Expand'}
          >
            {Silian_isExpanded ? '−' : '+'}
          </Silian_Button>
        </div>
      </Silian_CardHeader>
      <Silian_CardContent className="p-4 max-h-64 overflow-y-auto">
        {Silian_isExpanded ? (
          <pre className="text-xs font-mono bg-muted/50 rounded p-2 whitespace-pre-wrap">
            {Silian_jsonString}
          </pre>
        ) : (
          <div className="text-sm text-muted-foreground">
            Click to expand
          </div>
        )}
      </Silian_CardContent>
    </Silian_Card>
  );
};

export default Silian_AuditJsonField;
