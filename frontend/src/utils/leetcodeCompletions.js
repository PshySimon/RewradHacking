import { snippetCompletion } from "@codemirror/autocomplete";

export const leetcodeKeywords = [
    "def", "class", "import", "from", "return", "pass", "yield", "if", "elif", "else", 
    "for", "while", "in", "and", "or", "not", "is", "break", "continue", "True", "False", "None", "async", "await", "with", "as"
];

// 面试常考但经常记不住确切拼写的核心大杀器包
export const leetcodeLibs = [
    "collections", "defaultdict", "deque", "Counter", "OrderedDict",
    "heapq", "heappush", "heappop", "heapify",
    "math", "inf", "sqrt", "gcd", "lcm", "floor", "ceil",
    "bisect", "bisect_left", "bisect_right", "insort",
    "itertools", "permutations", "combinations", "accumulate",
    "typing", "List", "Dict", "Set", "Tuple", "Optional", "Any",
    "functools", "lru_cache", "cmp_to_key", "reduces"
];

// 定制化的 CodeMirror 竞技场拦截型补全源
export function leetcodeCompletionSource(context) {
    // 匹配光标前的单字
    let word = context.matchBefore(/\w*/);
    
    // 如果还没打字，且不是明确按快捷键呼出的，不乱提示
    if (word.from === word.to && !context.explicit) return null;

    const options = [];

    // 1. 注入竞技场精选白名单！
    leetcodeKeywords.forEach(k => options.push({ label: k, type: "keyword", boost: 2 }));
    leetcodeLibs.forEach(k => options.push({ label: k, type: "class", boost: 1 }));

    // 1.5 诸如 main 级结构展开的高级 Snippet (极速组装占位块)
    options.push(
        snippetCompletion('if __name__ == "__main__":\n    ${}', {
            label: "main",
            detail: "Execution Block",
            type: "keyword",
            boost: 5
        }),
        snippetCompletion('class Solution:\n    def ${solve}(self, ${nums}):\n        ${}', {
            label: "class Solution",
            detail: "LeetCode Base",
            type: "class",
            boost: 5
        })
    );

    // 2. 将当前文档所有已经敲击的且长度 > 2 的单词，纳入局部提示池
    const docText = context.state.doc.toString();
    const wordMatches = docText.match(/\b[a-zA-Z_]\w{1,}\b/g) || [];
    const uniqueLocalWords = [...new Set(wordMatches)];
    
    // 过滤掉已经在上方池子里的
    const predefined = new Set([...leetcodeKeywords, ...leetcodeLibs]);
    
    uniqueLocalWords.forEach(lw => {
        if (!predefined.has(lw)) {
            // 用 "variable" 会显示类似[v]的样子，以区分内置关键词。
            options.push({ label: lw, type: "variable", boost: 0 });
        }
    });

    return {
        from: word.from,
        options: options,
        validFor: /^\w*$/  // 只有字母数字下划线时，补全框持续有效
    };
}
