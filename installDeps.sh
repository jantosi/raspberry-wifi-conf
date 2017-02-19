if [ $(id -u) -ne 0 ] ; then echo "Please run as root" ; exit 1 ; fi
usr=$(env | grep SUDO_USER | cut -d= -f 2)

# install in default user dir
cd /home/pi

curl -sL https://deb.nodesource.com/setup_6.x | bash -
apt-get install -y nodejs bridge-utils hostapd udhcpd
npm install bower --global

# We don't need sudo permissions, so run the following as $usr
sudo -u $usr git clone https://github.com/jantosi/raspberry-wifi-conf.git
cd raspberry-wifi-conf
sudo -u $usr npm install
sudo -u $usr npm update
sudo -u $usr bower install

npm run-script provision

cp assets/init.d/raspberry-wifi-conf /etc/init.d/raspberry-wifi-conf 
chmod +x /etc/init.d/raspberry-wifi-conf  
update-rc.d raspberry-wifi-conf defaults

#iptables-apply raspberry-wifi-conf/iptables-rulefiles/as-appliance.rules
#iptables-apply raspberry-wifi-conf/iptables-rulefiles/as-ap.rules