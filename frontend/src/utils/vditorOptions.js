import { observeVditorCallouts, transformVditorRenderedHtml } from './vditorCallouts.js';
import { decorateResponsiveMath } from './vditorResponsiveMath.js';

export const VDITOR_LOCAL_CDN = '/vendor/vditor';

export const VDITOR_MATH_OPTIONS = Object.freeze({
    inlineDigit: true,
});

const composeTransforms = (firstTransform, secondTransform) => {
    if (!firstTransform) return secondTransform;
    if (!secondTransform) return firstTransform;
    return (html) => secondTransform(firstTransform(html));
};

const scheduleRenderedDecorations = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    console.debug('[VditorCalloutDebug] schedule-decoration');
    window.requestAnimationFrame(() => {
        observeVditorCallouts(document);
        decorateResponsiveMath(document);
    });
};

const composeAfterCallbacks = (firstAfter, secondAfter) => () => {
    if (typeof firstAfter === 'function') {
        firstAfter();
    }
    if (typeof secondAfter === 'function') {
        secondAfter();
    }
};

const composeInputCallbacks = (firstInput, secondInput) => (value) => {
    if (typeof firstInput === 'function') {
        firstInput(value);
    }
    if (typeof secondInput === 'function') {
        secondInput(value);
    }
};

export const buildVditorEditorOptions = (options = {}) => {
    const { after, input, preview = {}, ...rest } = options;

    return {
        cdn: VDITOR_LOCAL_CDN,
        ...rest,
        after: composeAfterCallbacks(after, scheduleRenderedDecorations),
        input: composeInputCallbacks(input, scheduleRenderedDecorations),
        preview: {
            ...preview,
            math: {
                ...VDITOR_MATH_OPTIONS,
                ...(preview.math || {}),
            },
            transform: composeTransforms(transformVditorRenderedHtml, preview.transform),
        },
    };
};

export const buildVditorRenderOptions = (options = {}) => ({
    cdn: VDITOR_LOCAL_CDN,
    ...options,
    math: {
        ...VDITOR_MATH_OPTIONS,
        ...(options.math || {}),
    },
    transform: composeTransforms(transformVditorRenderedHtml, options.transform),
    after: composeAfterCallbacks(options.after, scheduleRenderedDecorations),
});
