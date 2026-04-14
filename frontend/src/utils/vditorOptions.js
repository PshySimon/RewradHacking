export const VDITOR_LOCAL_CDN = '/vendor/vditor';

export const VDITOR_MATH_OPTIONS = Object.freeze({
    inlineDigit: true,
});

export const buildVditorEditorOptions = (options = {}) => {
    const { preview = {}, ...rest } = options;

    return {
        cdn: VDITOR_LOCAL_CDN,
        ...rest,
        preview: {
            ...preview,
            math: {
                ...VDITOR_MATH_OPTIONS,
                ...(preview.math || {}),
            },
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
});
