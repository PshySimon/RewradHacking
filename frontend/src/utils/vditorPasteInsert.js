export const insertPastedPlainText = (vditor, plainText) => {
    if (!vditor || typeof plainText !== 'string') {
        return;
    }

    if (typeof vditor.insertMD === 'function') {
        vditor.insertMD(plainText);
        return;
    }

    if (typeof vditor.insertValue === 'function') {
        vditor.insertValue(plainText);
    }
};
