const RESPONSIVE_MATH_CLASS = 'rh-responsive-math';
const SCALED_MATH_CLASS = 'rh-responsive-math--scaled';
const SCROLL_MATH_CLASS = 'rh-responsive-math--scroll';
const DEFAULT_MIN_SCALE = 0.72;
const MATH_SELECTOR = '.katex-display, .language-math';

export const calculateMathFit = ({
    availableWidth,
    contentWidth,
    minScale = DEFAULT_MIN_SCALE,
}) => {
    if (!Number.isFinite(availableWidth) || !Number.isFinite(contentWidth) || availableWidth <= 0 || contentWidth <= 0) {
        return { mode: 'none', scale: 1 };
    }

    if (contentWidth <= availableWidth) {
        return { mode: 'none', scale: 1 };
    }

    const scale = availableWidth / contentWidth;
    if (scale >= minScale) {
        return {
            mode: 'scale',
            scale: Number(scale.toFixed(3)),
        };
    }

    return { mode: 'scroll', scale: 1 };
};

const isDisplayMathElement = (element) => {
    if (!element?.classList) {
        return false;
    }

    if (element.classList.contains('katex-display')) {
        return true;
    }

    if (!element.classList.contains('language-math')) {
        return false;
    }

    return element.tagName !== 'SPAN'
        || element.closest('.vditor-align--center')
        || element.parentElement?.childElementCount === 1;
};

const collectMathElements = (root) => {
    const elements = [];
    if (root?.matches?.(MATH_SELECTOR)) {
        elements.push(root);
    }
    root?.querySelectorAll?.(MATH_SELECTOR).forEach((element) => elements.push(element));
    return elements;
};

const resetResponsiveMathState = (element) => {
    element.classList.remove(SCALED_MATH_CLASS, SCROLL_MATH_CLASS);
    element.style.removeProperty('--rh-math-scale');
    element.style.removeProperty('--rh-math-scaled-height');
};

const getMeasureElement = (element) => element.querySelector?.(':scope > .katex')
    || element.querySelector?.('.katex')
    || element.firstElementChild
    || element;

export const decorateResponsiveMath = (root = (typeof document === 'undefined' ? null : document)) => {
    if (typeof document === 'undefined') {
        return;
    }

    collectMathElements(root).forEach((element) => {
        if (!isDisplayMathElement(element)) {
            return;
        }

        element.classList.add(RESPONSIVE_MATH_CLASS);
        resetResponsiveMathState(element);

        const measureElement = getMeasureElement(element);
        const availableWidth = element.clientWidth || element.parentElement?.clientWidth || 0;
        const contentWidth = measureElement.scrollWidth || measureElement.getBoundingClientRect?.().width || 0;
        const fit = calculateMathFit({ availableWidth, contentWidth });

        if (fit.mode === 'scale') {
            const contentHeight = measureElement.scrollHeight || measureElement.getBoundingClientRect?.().height || 0;
            element.classList.add(SCALED_MATH_CLASS);
            element.style.setProperty('--rh-math-scale', String(fit.scale));
            if (contentHeight > 0) {
                element.style.setProperty('--rh-math-scaled-height', `${Math.ceil(contentHeight * fit.scale)}px`);
            }
            return;
        }

        if (fit.mode === 'scroll') {
            element.classList.add(SCROLL_MATH_CLASS);
        }
    });
};
