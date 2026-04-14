import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { autocompletion } from '@codemirror/autocomplete';
import { indentUnit } from '@codemirror/language';
import { leetcodeCompletionSource } from '../../utils/leetcodeCompletions';

export default function CodeLayout({ codeTemplate, setCodeTemplate }) {
    return (
        <div style={{ 
            flex: 1, minWidth: 0, 
            background: '#1E1E1E', borderRadius: '16px', display: 'flex', flexDirection: 'column',
            boxShadow: '0 10px 40px rgba(0,0,0,0.08)'
        }}>
            <div style={{ height: '44px', background: '#252526', display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #161616', borderRadius: '16px 16px 0 0', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '8px', marginRight: '16px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FF5F56' }}></div>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FFBD2E' }}></div>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27C93F' }}></div>
                </div>
                <span style={{ color: '#D4D4D4', fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px' }}>solution_template.py</span>
            </div>
            
            <div style={{ flex: 1, position: 'relative' }}>
                <CodeMirror
                    value={codeTemplate}
                    height="100%"
                    theme={vscodeDark}
                    extensions={[
                        python(), 
                        autocompletion({ override: [leetcodeCompletionSource] }),
                        indentUnit.of("    ") // 强制覆盖默认为4个空格缩进
                    ]}
                    onChange={(val) => setCodeTemplate(val)}
                    style={{ 
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                        fontSize: '14.5px', fontFamily: '"SF Mono", "Fira Code", Consolas, monospace'
                    }}
                    basicSetup={{
                        autocompletion: true, // 核心驱动点火！这是必加生命线！
                        tabSize: 4,                  // 与 indentUnit 配合确保一致
                        lineNumbers: true,           
                        foldGutter: false,           
                        highlightActiveLine: false,   
                        highlightActiveLineGutter: false, 
                        indentOnInput: true          
                    }}
                />
            </div>
        </div>
    );
}
