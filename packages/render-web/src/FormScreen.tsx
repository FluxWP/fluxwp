// Manifest form. Field rules and submit live in useFormController; this file only draws the controls.
import { Controller } from 'react-hook-form';
import type { FormScreen as FormModel, Manifest } from '@fluxwp/manifest';
import { useFormController, useRenderer } from '@fluxwp/runtime';
import { useMinWidth, TABLE_MIN } from './width';
import { Select } from '@fluxwp/ui';

export function FormScreen({ manifest, screen, params }: { manifest: Manifest; screen: FormModel; params: Record<string, string> }) {
  const c = useFormController(manifest, screen, params);
  const { t, nav } = useRenderer();
  const wide = useMinWidth(TABLE_MIN);
  const { register, control, formState } = c.form;

  const cancel = () => {
    if (c.dirtyGuard && c.dirty && !window.confirm(t('desktop.cancel'))) return;
    nav.back();
  };

  return (
    <div className={'fx-screen' + (wide ? ' form-side' : '')}>
      <form className="fx-form" onSubmit={(e) => void c.submit(e)}>
        <header className="fx-head">
          <h1>{c.title}</h1>
          <div className="fx-row">
            <button type="button" className="fx-btn" onClick={cancel}>{t('desktop.back')}</button>
            <button type="submit" className="fx-btn primary" disabled={c.submitting}>{c.submitting ? t('form.saving') : t('form.submit')}</button>
          </div>
        </header>
        {c.loading && <div className="fx-skel" />}
        {formState.errors.root?.message && <p className="fx-error">{t(String(formState.errors.root.message))}</p>}
        <div className="fx-fields">
          {c.fields.map((f) => {
            const err = formState.errors[f.name]?.message;
            const message = typeof err === 'string' ? t(err) : '';
            if (f.type === 'switch') {
              return (
                <label key={f.name} className={'fx-field ' + (f.width === 'half' ? 'half' : '')}>
                  <span>{f.label}</span>
                  <Controller control={control} name={f.name} render={({ field }) => <input type="checkbox" checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} onBlur={field.onBlur} />} />
                </label>
              );
            }
            if (f.type === 'segmented' && Array.isArray(f.options)) {
              return (
                <fieldset key={f.name} className="fx-field">
                  <legend>{f.label}</legend>
                  <Controller
                    control={control}
                    name={f.name}
                    render={({ field }) => (
                      <div className="fx-seg">
                        {f.options && Array.isArray(f.options) && f.options.map((o) => (
                          <button key={o.value} type="button" className={field.value === o.value ? 'on' : ''} onClick={() => field.onChange(o.value)}>{o.label}</button>
                        ))}
                      </div>
                    )}
                  />
                </fieldset>
              );
            }
            const inputType = f.type === 'email' || f.type === 'url' || f.type === 'number' || f.type === 'date' || f.type === 'time' || f.type === 'color' ? f.type : f.type === 'datetime' ? 'datetime-local' : f.type === 'phone' ? 'tel' : f.type === 'secret' ? 'password' : 'text';
            return (
              <label key={f.name} className={'fx-field ' + (f.width === 'half' ? 'half' : '')}>
                <span>{f.label}</span>
                {f.type === 'textarea' || f.type === 'markdown' ? (
                  <textarea {...register(f.name, c.rules(f))} placeholder={f.placeholder} readOnly={f.readonly} rows={4} />
                ) : f.type === 'select' && Array.isArray(f.options) ? (
                  <Controller control={control} name={f.name} rules={c.rules(f)} render={({field}) => <Select {...field} value={String(field.value ?? '')} disabled={f.readonly}>
                    <option value="" />
                    {(Array.isArray(f.options) ? f.options : []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>} />
                ) : f.type === 'readonly' ? (
                  <input readOnly value={String(c.form.getValues(f.name) ?? '')} />
                ) : (
                  <input type={inputType} {...register(f.name, c.rules(f))} placeholder={f.placeholder} readOnly={f.readonly} />
                )}
                {f.help && <small className="fx-muted">{f.help}</small>}
                {message && <small className="fx-error">{message}</small>}
              </label>
            );
          })}
        </div>
      </form>
    </div>
  );
}
