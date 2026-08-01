/**
 * Minimal stand-in for `expo-image-manipulator`, wired in via
 * `vitest.config.ts`. Only shaped enough to satisfy module evaluation —
 * nothing in the test suite calls into image manipulation.
 */

export const SaveFormat = { JPEG: 'jpeg' };

export const ImageManipulator = {
  manipulate(_uri: string) {
    return {
      resize(_target: unknown) {
        return this;
      },
      async renderAsync() {
        return {
          async saveAsync() {
            return { uri: 'file:///test/rendered.jpg', base64: '' };
          },
        };
      },
    };
  },
};
