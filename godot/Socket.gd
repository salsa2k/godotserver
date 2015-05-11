extends Node

####################################################################################################
# Config
####################################################################################################
const port = 7200
var ip = "127.0.0.1"
var debug = true;

####################################################################################################
# Socket
####################################################################################################
var connection = null
var peerstream = null
var connected = false
var timeout = 5
var timer

####################################################################################################
# Debug
####################################################################################################
function _Debug(msg):
	if (debug):
		print("[SOCKET]: " + msg)

####################################################################################################
# Socket is connected?
####################################################################################################
func IsConnected():
	return connected

####################################################################################################
# Connect
####################################################################################################
func Connect(args):
	# Verify if have arguments
	if (args.empty()):
		Disconnect()

	# Connect
	connection = StreamPeerTCP.new()
	connection.connect(ip, port)
	
	# Timeout
	timer = Timer.new()
	add_child(timer)	
	timer.set_wait_time(timeout)
	timer.set_one_shot(true)
	timer.connect("timeout", self, "_TimeoutDisconnect")
	timer.start()
	
	# Proccess
	set_process(true)
	
	# Dialog
	get_node("/root/Dialog").Show({
		"width": 150,
		"height": 80,
		"label": "Trying to connect ..."
	})

# OnClient
func OnClient():
	# Connected
	if (!connected && connection.get_status() == connection.STATUS_CONNECTED):
		connected = true
		
		peerstream = PacketPeerStream.new()
		peerstream.set_stream_peer(connection)
		
	# Disconnected
	if (connection.get_status() == connection.STATUS_NONE or connection.get_status() == connection.STATUS_ERROR):
		set_process(false)
		Disconnect()
		
	# Connected and receiving data
	if (connected):	
		if (peerstream.get_available_packet_count() > 0):
			var data = peerstream.get_var()
			OnData(data)

func OnData(data):
	if (data.action == "welcome"):
		Send({
			"type": "AUTH",
			"action": "login",
			"username": get_node("/root/EditUsername").get_text(),
			"password": get_node("/root/EditPassword").get_text()
		})
		
	# Load lobby
	if (data.action == "authorized"):
		get_node("/root/SceneManager").JumpTo("lobby")

####################################################################################################
# Disconnect
####################################################################################################
func Disconnect():
	if (connected):
		connection.disconnect()
		connected = false
	
	get_node("/root/SceneManager").JumpTo("login")
	get_node("/root/Dialog").Hide()
	
	get_node("/root/EditUsername").set_text("")
	get_node("/root/EditPassword").set_text("")

####################################################################################################
# Timeout disconnect
####################################################################################################
func _TimeoutDisconnect():
	timer.stop()
	remove_child(timer)
	
	if (!connected):
		Disconnect()

####################################################################################################
# Process
####################################################################################################
func _process(delta):
	OnClient()

####################################################################################################
# Send data
####################################################################################################
func Send(data):
	if (data != ""):
		peerstream.put_var(data)
