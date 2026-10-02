package com.syncwatch.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * Replaces the empty MainActivity that `cap add android` generates, to register
 * the app's own native plugin(s). Local plugins must be registered before
 * super.onCreate(). Copied in by .github/workflows/android.yml.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ImmersivePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
