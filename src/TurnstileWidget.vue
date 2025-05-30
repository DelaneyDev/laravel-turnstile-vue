<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
/**
* TurnstileWidget.vue
* A reusable, SSR-safe Cloudflare Turnstile CAPTCHA component.
* Provides v-model for token binding and default behavior for error handling.
* Includes automatic reset on expiration and error, with exposed reset/execute methods.
*/
const props = defineProps({
    /** Cloudflare Turnstile sitekey (required) */
    sitekey: { type: String, required: true },
    /** v-model binding for the CAPTCHA token */
    modelValue: String,
    /** Optional: disables default auto-reset on CAPTCHA error */
    disableAutoReload: { type: Boolean, default: false },
    /** Optional: widget theme ('light' or 'dark') */
    theme: { type: String, default: 'light' },
    /** Optional: widget size ('normal', 'compact', 'invisible') */
    size: { type: String, default: 'normal' },
});
const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'error'): void;
    (e: 'expired'): void;
}>();
const containerRef = ref<HTMLDivElement | null>(null);
let widgetId: string | null = null;
const isClient = typeof window !== 'undefined';
const hydrated = ref(false);
/**
* Dynamically loads Turnstile API script if not already present.
*/
const loadTurnstileScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!isClient) return reject();
        if (window.turnstile) return resolve();
        const existingScript = document.querySelector('#cf-turnstile');
        if (existingScript) return resolve();
        const script = document.createElement('script');
        script.id = 'cf-turnstile';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject();
        document.head.appendChild(script);
    });
};
/**
* Renders the Turnstile widget inside the container.
*/
const renderTurnstileWidget = () => {
    if (!isClient || !window.turnstile || !containerRef.value) return;
    widgetId = window.turnstile.render(containerRef.value, {
        sitekey: props.sitekey,
        theme: props.theme,
        size: props.size,
        callback: (token: string) => emit('update:modelValue', token),
        'expired-callback': () => {
            emit('update:modelValue', '');
            emit('expired');
            if (!props.disableAutoReload) resetWidget();
        },
        'error-callback': () => {
            emit('error');
            if (!props.disableAutoReload) resetWidget();
        },
    });
};
/**
* Resets the Turnstile widget manually.
*/
const resetWidget = () => {
    if (isClient && window.turnstile && widgetId) {
        try {
            window.turnstile.reset(widgetId);
        } catch (e) {
            console.warn('[TurnstileWidget] Reset failed:', e);
        }
    }
};
/**
* Executes the Turnstile widget manually (for invisible mode).
*/
const executeWidget = () => {
    if (isClient && window.turnstile && widgetId) {
        try {
            window.turnstile.execute(widgetId);
        } catch (e) {
            console.warn('[TurnstileWidget] Execute failed:', e);
        }
    }
};
defineExpose({
    reset: resetWidget,
    execute: executeWidget,
});
onMounted(() => {
    hydrated.value = true;
    loadTurnstileScript()
        .then(() => renderTurnstileWidget())
        .catch(() => {
            emit('error');
            if (!props.disableAutoReload) resetWidget();
        });
});
onBeforeUnmount(() => {
    if (isClient && window.turnstile && widgetId) {
        try {
            window.turnstile.remove(widgetId);
        } catch (e) {
            console.warn('[TurnstileWidget] Cleanup failed:', e);
        }
    }
});
</script>
<template>
    <!-- Render container only after client-side hydration with fallback -->
    <div v-if="hydrated" ref="containerRef" />
    <div v-else style="min-height:48px" aria-hidden="true"></div>
</template>