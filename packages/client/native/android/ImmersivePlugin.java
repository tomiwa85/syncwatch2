package com.syncwatch.app;

import android.app.Activity;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The app's system-bar policy:
 *  - the bottom navigation bar is hidden on EVERY screen;
 *  - during fullscreen video the top status bar is hidden too.
 * A swipe from the edge brings the bars back briefly, then they auto-hide —
 * the standard Android immersive behaviour. (The web layer and
 * @capacitor/status-bar can't reach the navigation bar, hence native code.)
 *
 * Copied into the generated Android project by .github/workflows/android.yml.
 */
@CapacitorPlugin(name = "Immersive")
public class ImmersivePlugin extends Plugin {

    /** True while a video is fullscreen (set from JS via enter/exit). */
    private static boolean videoFullscreen = false;

    /** Apply the policy. Called at launch, whenever the app regains focus
     *  (returning from the file picker, dialogs, the keyboard can all bring the
     *  bars back), and when video fullscreen starts/ends. */
    public static void applyBars(Activity activity) {
        Window window = activity.getWindow();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.navigationBars());
        if (videoFullscreen) {
            controller.hide(WindowInsetsCompat.Type.statusBars());
        } else {
            controller.show(WindowInsetsCompat.Type.statusBars());
        }
    }

    /** Video went fullscreen: hide the status bar as well. */
    @PluginMethod
    public void enter(PluginCall call) {
        videoFullscreen = true;
        getActivity().runOnUiThread(() -> {
            applyBars(getActivity());
            call.resolve();
        });
    }

    /** Video left fullscreen: status bar back; navigation bar stays hidden. */
    @PluginMethod
    public void exit(PluginCall call) {
        videoFullscreen = false;
        getActivity().runOnUiThread(() -> {
            applyBars(getActivity());
            call.resolve();
        });
    }
}
