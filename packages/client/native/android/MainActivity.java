package com.syncwatch.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * Replaces the empty MainActivity that `cap add android` generates. Copied in
 * by .github/workflows/android.yml.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before super.onCreate().
        registerPlugin(ImmersivePlugin.class);
        super.onCreate(savedInstanceState);
        // Hide the bottom navigation bar from the very first frame.
        ImmersivePlugin.applyBars(this);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Re-apply after anything that can bring the bars back: returning to
        // the app, the system file picker, dialogs, the keyboard.
        if (hasFocus) ImmersivePlugin.applyBars(this);
    }
}
