import React, { createContext, useContext, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useGetGenerationStatus } from "@workspace/api-client-react";

interface ActiveGeneration {
  id: string;
  creditsUsed: number;
}

interface GenerationWatcherContextValue {
  setActiveGeneration: (gen: ActiveGeneration | null) => void;
}

const GenerationWatcherContext = createContext<GenerationWatcherContextValue>({
  setActiveGeneration: () => {},
});

export function useSetActiveGeneration() {
  return useContext(GenerationWatcherContext).setActiveGeneration;
}

// Maximum number of extra polls after first seeing "failed" before giving up on refund confirmation
const MAX_REFUND_RETRIES = 4;

// Inner component that actually polls — only rendered when there's an active job
function GenerationStatusPoller({ gen, onDone }: { gen: ActiveGeneration; onDone: () => void }) {
  const queryClient = useQueryClient();
  // Track how many times we've polled after first seeing "failed" without a confirmed refund
  const failedPollsRef = React.useRef(0);

  const { data: statusData, dataUpdatedAt } = useGetGenerationStatus(gen.id, {
    query: {
      refetchInterval: (query) => {
        const d = query.state.data;
        if (!d) return 4000;
        if (d.status === "completed") return false;
        if (d.status === "failed") {
          // Keep polling until refund is confirmed or we've retried enough
          if (d.refunded === true) return false;
          if (failedPollsRef.current >= MAX_REFUND_RETRIES) return false;
          return 2000; // Poll faster while waiting for refund confirmation
        }
        return 4000;
      },
    },
  });

  // Use dataUpdatedAt so this fires after every fetch, even when data is unchanged.
  // This is necessary because the server may return `failed` + `refunded: false` on the
  // first poll (background poller marked it failed but hasn't committed the refund yet),
  // and only show `refunded: true` on a subsequent poll.
  React.useEffect(() => {
    if (!statusData) return;

    if (statusData.status === "completed") {
      failedPollsRef.current = 0;
      onDone();
    } else if (statusData.status === "failed") {
      if (statusData.refunded === true && statusData.creditsRefunded) {
        failedPollsRef.current = 0;
        onDone();
        toast.success(`${statusData.creditsRefunded} credits refunded`, {
          description: "Generation failed — your credits have been returned to your balance.",
          duration: 6000,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      } else {
        failedPollsRef.current += 1;
        if (failedPollsRef.current > MAX_REFUND_RETRIES) {
          failedPollsRef.current = 0;
          onDone();
          // No refund confirmed within retry window — just stop silently
          // (the artist can check their balance manually)
        }
        // else: keep polling — refetchInterval will schedule the next fetch
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt]);

  return null;
}

export function GenerationWatcherProvider({ children }: { children: React.ReactNode }) {
  const [activeGen, setActiveGenState] = React.useState<ActiveGeneration | null>(null);
  const setActiveGenRef = useRef(setActiveGenState);
  setActiveGenRef.current = setActiveGenState;

  const setActiveGeneration = useCallback((gen: ActiveGeneration | null) => {
    setActiveGenRef.current(gen);
  }, []);

  return (
    <GenerationWatcherContext.Provider value={{ setActiveGeneration }}>
      {children}
      {activeGen && (
        <GenerationStatusPoller
          key={activeGen.id}
          gen={activeGen}
          onDone={() => setActiveGeneration(null)}
        />
      )}
    </GenerationWatcherContext.Provider>
  );
}
