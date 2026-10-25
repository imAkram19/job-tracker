using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Net.NetworkInformation;
using System.Threading;
using System.Windows.Forms;

namespace AkramJobTracker
{
    public class Program
    {
        private static readonly string AppDir = AppDomain.CurrentDomain.BaseDirectory;
        private static readonly string LogPath = Path.Combine(AppDir, "logs", "app-server.log");
        private static readonly object LogLock = new object();
        private static Process serverProcess;
        private static string appUrl;

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            bool isNewInstance;
            using (var mutex = new Mutex(true, "AkramJobTrackerSingleInstanceMutex", out isNewInstance))
            {
                try
                {
                    appUrl = DetectActiveUrl();
                    if (!isNewInstance)
                    {
                        if (appUrl != null) OpenAppWindow();
                        else MessageBox.Show("Job Tracker is still starting. Please wait, or open Server Logs from its tray icon.", "Job Tracker");
                        return;
                    }
                    if (appUrl == null) StartBackgroundServer();
                    OpenAppWindow();
                    Application.Run(new TrayContext());
                }
                catch (Exception ex)
                {
                    Log(ex.ToString());
                    StopServer();
                    MessageBox.Show("Job Tracker could not start.\n\n" + ex.Message + "\n\nDetails: " + LogPath,
                        "Job Tracker startup failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
        }

        private static void Log(string message)
        {
            try
            {
                lock (LogLock)
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(LogPath));
                    File.AppendAllText(LogPath, DateTime.Now.ToString("s") + " " + message + Environment.NewLine);
                }
            }
            catch { /* Startup error is also shown in a dialog. */ }
        }

        private static string DetectActiveUrl()
        {
            for (int port = 3000; port < 3010; port++)
            {
                string url = "http://127.0.0.1:" + port;
                if (IsOurServer(url)) return url;
            }
            return null;
        }

        private static bool IsOurServer(string url)
        {
            try
            {
                var req = (HttpWebRequest)WebRequest.Create(url + "/api/automation/health");
                req.Timeout = 700;
                req.ReadWriteTimeout = 700;
                req.Proxy = null;
                using (var resp = (HttpWebResponse)req.GetResponse())
                using (var reader = new StreamReader(resp.GetResponseStream()))
                {
                    string json = reader.ReadToEnd().Replace(" ", "");
                    return json.Contains("\"application\":\"akram-job-tracker\"") && json.Contains("\"desktop\":true");
                }
            }
            catch { return false; }
        }

        private static string FindNode()
        {
            string node = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe");
            if (File.Exists(node)) return node;
            foreach (string entry in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';'))
            {
                try
                {
                    node = Path.Combine(entry.Trim().Trim('"'), "node.exe");
                    if (File.Exists(node)) return node;
                }
                catch { }
            }
            throw new InvalidOperationException("Node.js was not found. Install Node.js, then reopen this EXE.");
        }

        private static Process RunNode(string node, string arguments)
        {
            var psi = new ProcessStartInfo(node, arguments);
            psi.WorkingDirectory = AppDir;
            psi.CreateNoWindow = true;
            psi.UseShellExecute = false;
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            psi.EnvironmentVariables["AKRAM_DESKTOP"] = "1";
            psi.EnvironmentVariables["NODE_ENV"] = "production";
            psi.EnvironmentVariables.Remove("VERCEL");
            var process = new Process();
            process.StartInfo = psi;
            process.OutputDataReceived += (s, e) => { if (e.Data != null) Log(e.Data); };
            process.ErrorDataReceived += (s, e) => { if (e.Data != null) Log(e.Data); };
            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            return process;
        }

        private static bool NeedsBuild()
        {
            string output = Path.Combine(AppDir, ".next-desktop");
            string buildId = Path.Combine(output, "BUILD_ID");
            if (!File.Exists(buildId) || !File.Exists(Path.Combine(output, "server", "app-paths-manifest.json"))) return true;
            DateTime builtAt = File.GetLastWriteTimeUtc(buildId);
            foreach (string file in new[] { "package.json", "package-lock.json", "next.config.mjs", "tsconfig.json" })
                if (File.GetLastWriteTimeUtc(Path.Combine(AppDir, file)) > builtAt) return true;
            foreach (string file in Directory.GetFiles(Path.Combine(AppDir, "src"), "*", SearchOption.AllDirectories))
            {
                // These are runtime stores, not source that needs recompilation.
                if (file.EndsWith("approvedAnswers.json") || file.EndsWith("portalAccounts.json")) continue;
                if (File.GetLastWriteTimeUtc(file) > builtAt) return true;
            }
            return false;
        }

        private static int FindFreePort()
        {
            for (int port = 3000; port < 3010; port++)
            {
                bool occupied = false;
                foreach (var endpoint in IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners())
                    if (endpoint.Port == port) occupied = true;
                if (occupied) continue;
                var listener = new TcpListener(IPAddress.Loopback, port);
                listener.ExclusiveAddressUse = true;
                try { listener.Start(); return port; }
                catch (SocketException) { }
                finally { listener.Stop(); }
            }
            throw new InvalidOperationException("Ports 3000-3009 are busy. Close an old Job Tracker server and try again.");
        }

        private static void StartBackgroundServer()
        {
            string next = Path.Combine(AppDir, "node_modules", "next", "dist", "bin", "next");
            if (!File.Exists(next)) throw new InvalidOperationException("Keep this EXE in the Job Tracker project folder with its installed dependencies.");
            string node = FindNode();
            if (NeedsBuild())
            {
                Log("Preparing desktop production build. First launch may take several minutes.");
                using (var build = RunNode(node, "\"" + next + "\" build"))
                {
                    if (!build.WaitForExit(300000))
                    {
                        KillProcessTree(build);
                        throw new InvalidOperationException("The desktop build timed out. See Server Logs.");
                    }
                    build.WaitForExit(); // Drain redirected output.
                    if (build.ExitCode != 0) throw new InvalidOperationException("The desktop build failed. See Server Logs for the build error.");
                }
            }
            int port = FindFreePort();
            appUrl = "http://127.0.0.1:" + port;
            Log("Starting desktop server at " + appUrl);
            serverProcess = RunNode(node, "\"" + next + "\" start --hostname 127.0.0.1 --port " + port);
            for (int i = 0; i < 90; i++)
            {
                if (serverProcess.HasExited) throw new InvalidOperationException("The desktop server exited before it was ready. See Server Logs.");
                if (IsOurServer(appUrl)) return;
                Thread.Sleep(500);
            }
            throw new InvalidOperationException("The desktop server did not become ready within 60 seconds. See Server Logs.");
        }

        public static void OpenAppWindow()
        {
            if (appUrl == null) throw new InvalidOperationException("The desktop server is not ready.");
            string chrome = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe");
            string edge = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe");
            if (File.Exists(chrome)) Process.Start(chrome, "--app=\"" + appUrl + "\"");
            else if (File.Exists(edge)) Process.Start(edge, "--app=\"" + appUrl + "\"");
            else Process.Start(appUrl);
        }

        private static void KillProcessTree(Process process)
        {
            try
            {
                if (process == null || process.HasExited) return;
                var psi = new ProcessStartInfo("taskkill", "/F /T /PID " + process.Id);
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                using (var killer = Process.Start(psi)) { killer.WaitForExit(5000); }
            }
            catch (Exception ex) { Log("Could not stop owned server: " + ex.Message); }
        }
        private static void StopServer() { KillProcessTree(serverProcess); }

        public class TrayContext : ApplicationContext
        {
            private NotifyIcon trayIcon;
            public TrayContext()
            {
                var menu = new ContextMenu();
                menu.MenuItems.Add("Open Job Tracker", (s, e) => OpenAppWindow());
                menu.MenuItems.Add("View Server Logs", (s, e) => { if (File.Exists(LogPath)) Process.Start("notepad.exe", LogPath); });
                menu.MenuItems.Add("Exit Application", (s, e) => {
                    trayIcon.Visible = false;
                    trayIcon.Dispose();
                    StopServer();
                    ExitThread();
                });
                trayIcon = new NotifyIcon { Text = "Akram Job Tracker (Running)", Icon = SystemIcons.Application, ContextMenu = menu, Visible = true };
                trayIcon.DoubleClick += (s, e) => OpenAppWindow();
            }
        }
    }
}
