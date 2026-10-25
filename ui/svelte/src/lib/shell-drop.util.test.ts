import { describe, expect, it } from 'vitest';
import {
  acceptsShellDropPath,
  archiveDropKind,
  isApplicationDropPath,
  shellDropKind,
} from './shell-drop.util';

const file = (path: string) => ({ path, directory: false });

describe('shell drop classification', () => {
  it('treats any non-archive file as an application drop', () => {
    const paths = ['C:\\Tools\\App.exe', 'C:\\Desktop\\App.lnk', 'C:\\Pictures\\holiday.png', 'C:\\Music\\song.mp3'];
    for (const path of paths) {
      expect(isApplicationDropPath(file(path))).toBe(true);
      expect(shellDropKind(file(path))).toBe('application');
    }
  });

  it('treats a dropped folder as an application drop', () => {
    expect(shellDropKind({ path: 'C:\\Users\\me\\Documents', directory: true })).toBe('application');
  });

  it('keeps the specialized archives out of the application case', () => {
    expect(shellDropKind(file('C:\\x\\icons.macrodeckiconpack'))).toBe('iconPack');
    expect(shellDropKind(file('C:\\x\\pack.macrodeckwidget'))).toBe('widgets');
    expect(isApplicationDropPath(file('C:\\x\\pack.macrodeckwidget'))).toBe(false);
    expect(archiveDropKind('C:\\x\\profile.macrodeckprofile')).toBe('profile');
  });

  it('accepts an image only where application drops are accepted', () => {
    expect(acceptsShellDropPath(file('C:\\Pictures\\holiday.png'), ['application'])).toBe(true);
    expect(acceptsShellDropPath(file('C:\\Pictures\\holiday.png'), ['widgets'])).toBe(false);
  });
});
