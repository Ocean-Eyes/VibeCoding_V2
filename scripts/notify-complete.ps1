param([string]$DevicePattern = 'Realtek', [switch]$List)
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

public static class CompletionAudio {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
 struct Caps {
  public ushort manufacturer, product;
  public uint driver;
  [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string name;
  public uint formats;
  public ushort channels, reserved;
  public uint support;
 }
 [StructLayout(LayoutKind.Sequential, Pack=2)]
 struct Format {
  public ushort tag, channels;
  public uint rate, bytesPerSecond;
  public ushort alignment, bits, extra;
 }
 [StructLayout(LayoutKind.Sequential)]
 struct Header {
  public IntPtr data;
  public uint length, recorded;
  public IntPtr user;
  public uint flags, loops;
  public IntPtr next, reserved;
 }
 [DllImport("winmm.dll")] static extern uint waveOutGetNumDevs();
 [DllImport("winmm.dll", CharSet=CharSet.Unicode)] static extern uint waveOutGetDevCapsW(UIntPtr id, out Caps caps, uint size);
 [DllImport("winmm.dll")] static extern uint waveOutOpen(out IntPtr handle, uint id, ref Format format, IntPtr callback, IntPtr instance, uint flags);
 [DllImport("winmm.dll")] static extern uint waveOutPrepareHeader(IntPtr handle, IntPtr header, uint size);
 [DllImport("winmm.dll")] static extern uint waveOutWrite(IntPtr handle, IntPtr header, uint size);
 [DllImport("winmm.dll")] static extern uint waveOutUnprepareHeader(IntPtr handle, IntPtr header, uint size);
 [DllImport("winmm.dll")] static extern uint waveOutReset(IntPtr handle);
 [DllImport("winmm.dll")] static extern uint waveOutClose(IntPtr handle);
 static void Check(uint result) { if(result!=0) throw new InvalidOperationException("Audio output error: "+result); }
 public static string[] Devices() {
  var names=new string[waveOutGetNumDevs()];
  for(uint i=0;i<names.Length;i++) { Caps caps; Check(waveOutGetDevCapsW((UIntPtr)i,out caps,(uint)Marshal.SizeOf(typeof(Caps)))); names[i]=caps.name; }
  return names;
 }
 public static string Play(string pattern) {
  var names=Devices(); int device=Array.FindIndex(names,n=>n.IndexOf(pattern,StringComparison.OrdinalIgnoreCase)>=0);
  if(device<0) throw new InvalidOperationException("No output matching: "+pattern);
  const int rate=44100; var pcm=new short[(int)(rate*.75)];
  for(int i=0;i<pcm.Length;i++) {
   double t=(double)i/rate, local=t<.30?t:t-.38;
   if(local<0||local>.30) continue;
   double envelope=Math.Min(1,Math.Min(local/.015,(.30-local)/.025));
   double frequency=t<.30?880:1175;
   pcm[i]=(short)(Math.Sin(2*Math.PI*frequency*local)*envelope*short.MaxValue*.18);
  }
  var format=new Format{tag=1,channels=1,rate=rate,bytesPerSecond=rate*2,alignment=2,bits=16,extra=0};
  IntPtr handle=IntPtr.Zero,buffer=IntPtr.Zero,header=IntPtr.Zero; bool prepared=false;
  uint size=(uint)Marshal.SizeOf(typeof(Header));
  try {
   Check(waveOutOpen(out handle,(uint)device,ref format,IntPtr.Zero,IntPtr.Zero,0));
   buffer=Marshal.AllocHGlobal(pcm.Length*2); Marshal.Copy(pcm,0,buffer,pcm.Length);
   header=Marshal.AllocHGlobal((int)size); Marshal.StructureToPtr(new Header{data=buffer,length=(uint)(pcm.Length*2)},header,false);
   Check(waveOutPrepareHeader(handle,header,size)); prepared=true; Check(waveOutWrite(handle,header,size));
   var deadline=DateTime.UtcNow.AddSeconds(5);
   while((((Header)Marshal.PtrToStructure(header,typeof(Header))).flags&1)==0) {
    if(DateTime.UtcNow>deadline) throw new TimeoutException("Audio device did not finish playback.");
    Thread.Sleep(10);
   }
   return names[device];
  } finally {
   if(handle!=IntPtr.Zero) { waveOutReset(handle); if(prepared)waveOutUnprepareHeader(handle,header,size); waveOutClose(handle); }
   if(header!=IntPtr.Zero)Marshal.FreeHGlobal(header); if(buffer!=IntPtr.Zero)Marshal.FreeHGlobal(buffer);
  }
 }
}
'@

if ($List) { [CompletionAudio]::Devices() } else { [CompletionAudio]::Play($DevicePattern) }
