<script setup lang="ts">
import { computed, ref } from 'vue';
import {
    TURNSTILE_TEST_SITEKEYS,
    TurnstileWidget,
    type TurnstileWidgetInstance,
} from '@package';

const visible = ref<TurnstileWidgetInstance | null>(null);
const invisible = ref<TurnstileWidgetInstance | null>(null);
const visibleToken = ref('');
const invisibleToken = ref('');
const invisiblePending = ref(false);
const events = ref<string[]>([]);

const visibleTokenLabel = computed(() =>
    visibleToken.value ? `${visibleToken.value.slice(0, 18)}...` : 'Waiting',
);
const invisibleTokenLabel = computed(() =>
    invisibleToken.value ? `${invisibleToken.value.slice(0, 18)}...` : 'Waiting',
);

function record(event: string, detail?: unknown): void {
    const suffix = typeof detail === 'string' ? ` (${detail})` : '';
    events.value = [`${event}${suffix}`, ...events.value].slice(0, 8);
}

async function runInvisibleChallenge(): Promise<void> {
    if (!invisible.value || invisiblePending.value) return;
    invisiblePending.value = true;

    try {
        invisibleToken.value = await invisible.value.challenge({
            force: true,
            timeoutMs: 30_000,
        });
        record('invisible:success');
    } catch (error: unknown) {
        record('invisible:error', error instanceof Error ? error.message : String(error));
    } finally {
        invisiblePending.value = false;
    }
}
</script>

<template>
    <main>
        <header class="page-header">
            <div>
                <p class="eyebrow">Browser verification</p>
                <h1>Turnstile harness</h1>
            </div>
            <span class="build-label">v2 live keys</span>
        </header>

        <section class="widget-section" aria-labelledby="visible-heading">
            <div class="section-heading">
                <div>
                    <h2 id="visible-heading">Visible widget</h2>
                    <p data-testid="visible-token">{{ visibleTokenLabel }}</p>
                </div>
                <button type="button" class="secondary" @click="visible?.reset()">
                    Reset
                </button>
            </div>

            <TurnstileWidget
                ref="visible"
                v-model="visibleToken"
                data-testid="visible-widget"
                :sitekey="TURNSTILE_TEST_SITEKEYS.visibleAlwaysPasses"
                action="browser_visible"
                size="flexible"
                @success="record('visible:success')"
                @error="record('visible:error', $event)"
                @expired="record('visible:expired')"
            />
        </section>

        <section class="widget-section" aria-labelledby="invisible-heading">
            <div class="section-heading">
                <div>
                    <h2 id="invisible-heading">Invisible widget</h2>
                    <p data-testid="invisible-token">{{ invisibleTokenLabel }}</p>
                </div>
                <button
                    type="button"
                    class="primary"
                    :disabled="invisiblePending"
                    @click="runInvisibleChallenge"
                >
                    {{ invisiblePending ? 'Verifying' : 'Challenge' }}
                </button>
            </div>

            <TurnstileWidget
                ref="invisible"
                v-model="invisibleToken"
                data-testid="invisible-widget"
                :sitekey="TURNSTILE_TEST_SITEKEYS.invisibleAlwaysPasses"
                execution="execute"
                appearance="execute"
                action="browser_invisible"
                :response-field="false"
                @error="record('invisible:error', $event)"
            />
        </section>

        <section class="event-section" aria-labelledby="events-heading">
            <div class="section-heading">
                <h2 id="events-heading">Events</h2>
                <button type="button" class="secondary" @click="events = []">
                    Clear
                </button>
            </div>
            <ol aria-live="polite" data-testid="events">
                <li v-for="(event, index) in events" :key="`${event}-${index}`">
                    {{ event }}
                </li>
                <li v-if="events.length === 0" class="muted">No events</li>
            </ol>
        </section>
    </main>
</template>
