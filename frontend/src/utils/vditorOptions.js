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

const composeAfterCallbacks = (firstAfter, secondAfter) => {
    if (!firstAfter) return secondAfter;
    if (!secondAfter) return firstAfter;
    return () => {
        if (typeof firstAfter === 'function') {
            firstAfter();
        }
        if (typeof secondAfter === 'function') {
            secondAfter();
        }
    };
};

const composeInputCallbacks = (firstInput, secondInput) => {
    if (!firstInput) return secondInput;
    if (!secondInput) return firstInput;
    return (value) => {
        if (typeof firstInput === 'function') {
            firstInput(value);
        }
        if (typeof secondInput === 'function') {
            secondInput(value);
        }
    };
};

export const buildVditorEditorOptions = (options = {}) => {
    const {
        after,
        input,
        preview = {},
        decorateOnAfter = true,
        decorateOnInput = true,
        ...rest
    } = options;

    const afterCallback = composeAfterCallbacks(after, decorateOnAfter ? scheduleRenderedDecorations : undefined);
    const inputCallback = composeInputCallbacks(input, decorateOnInput ? scheduleRenderedDecorations : undefined);

    return {
        cdn: VDITOR_LOCAL_CDN,
        ...rest,
        ...(afterCallback ? { after: afterCallback } : {}),
        ...(inputCallback ? { input: inputCallback } : {}),
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
